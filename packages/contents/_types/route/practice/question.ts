import { getExerciseQuestionRouteTitle } from "@repo/contents/_lib/assessment/label";
import { ExercisesMaterialSchema } from "@repo/contents/_types/assessment/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/assessment/type";
import type { Locale } from "@repo/contents/_types/content";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  InvalidPublicRouteSourceError,
  MissingPublicSlugError,
} from "@repo/contents/_types/route/error";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import {
  lookupDomainSlug,
  lookupNamespaceSegment,
  makePath,
  readDomainSlug,
  readNamespaceSegment,
} from "@repo/contents/_types/route/path";
import { isPracticeMaterialSource } from "@repo/contents/_types/route/practice/material";
import {
  getPracticeSourceGroupSlug,
  readPublicPracticeQuestionNumber,
  readSourcePracticePathParts,
  readSourcePracticeQuestionNumber,
  toPublicPracticeGroupSegment,
  toPublicPracticeQuestionSegment,
} from "@repo/contents/_types/route/practice/path";
import { readPublicPracticeSetMatch } from "@repo/contents/_types/route/practice/set";
import {
  type PublicPracticeQuestionRoute,
  PublicPracticeQuestionRouteSchema,
} from "@repo/contents/_types/route/schema";
import { PublicRouteSegmentSchema } from "@repo/contents/_types/route/segment";
import { locales } from "@repo/utilities/locales";
import { Effect, Option, Schema } from "effect";

const ExerciseQuestionPathInputSchema = Schema.Struct({
  assessment: ExercisesTypeSchema,
  domain: ExercisesMaterialSchema,
  exerciseType: PublicRouteSegmentSchema,
  locale: Schema.Literal(...locales),
  number: Schema.Int.pipe(Schema.greaterThanOrEqualTo(1)),
  setName: PublicRouteSegmentSchema,
  year: Schema.optional(Schema.Int.pipe(Schema.between(2000, 2100))),
});

export type ExerciseQuestionPathInput = Schema.Schema.Encoded<
  typeof ExerciseQuestionPathInputSchema
> &
  Pick<RouteInputs, "domains" | "materials">;

/** Builds a canonical public question path without deriving slugs from titles. */
export const toPublicExerciseQuestionPath = Effect.fn(
  "contents.route.exerciseQuestionPath"
)(function* (input: ExerciseQuestionPathInput) {
  const decoded = yield* Schema.decodeUnknown(ExerciseQuestionPathInputSchema)(
    input
  ).pipe(
    Effect.mapError(
      (error) =>
        new InvalidPublicRouteSourceError({
          message: String(error),
        })
    )
  );
  const materials = input.materials ?? MATERIAL_SOURCES;
  const domains = input.domains ?? MATERIAL_ROUTE_DOMAINS;
  const material = materials
    .filter(isPracticeMaterialSource)
    .find(
      (candidate) =>
        candidate.assessment === decoded.assessment &&
        candidate.domain === decoded.domain
    );

  if (!material) {
    return yield* Effect.fail(
      new MissingPublicSlugError({
        locale: decoded.locale,
        source: "practice-material",
        value: decoded.domain,
      })
    );
  }

  const group = material.groups.find(
    (candidate) =>
      candidate.exerciseType === decoded.exerciseType &&
      candidate.year === decoded.year
  );

  if (!group) {
    return yield* Effect.fail(
      new MissingPublicSlugError({
        locale: decoded.locale,
        source: "practice-activity",
        value: decoded.exerciseType,
      })
    );
  }

  return yield* makePath([
    yield* lookupNamespaceSegment("exercises", decoded.locale),
    material.assessment,
    yield* lookupDomainSlug(
      domains,
      "practice",
      material.domain,
      decoded.locale
    ),
    toPublicPracticeGroupSegment(group, decoded.locale),
    decoded.setName,
    toPublicPracticeQuestionSegment({
      locale: decoded.locale,
      number: decoded.number,
    }),
  ]);
});

/** Reads a virtual question route by localized public path segments during SSG. */
export function readPublicPracticeQuestionRouteByPath({
  domains,
  locale,
  materials,
  publicPath,
}: {
  domains: NonNullable<RouteInputs["domains"]>;
  locale: Locale;
  materials: NonNullable<RouteInputs["materials"]>;
  publicPath: string;
}): PublicPracticeQuestionRoute | undefined {
  const match = readPublicPracticeSetMatch({
    domains,
    locale,
    materials,
    publicPath,
  });

  if (!match?.parts.question) {
    return;
  }

  const questionNumber = readPublicPracticeQuestionNumber({
    locale,
    segment: match.parts.question,
  });

  if (questionNumber === null) {
    return;
  }

  const setPath = [
    match.parts.namespace,
    match.parts.assessment,
    match.parts.domain,
    match.parts.group,
    match.parts.set,
  ].join("/");
  const sourcePath = [
    match.material.assetRoot,
    getPracticeSourceGroupSlug(match.group),
    match.set.slug,
    questionNumber.toString(),
  ].join("/");

  return decodePracticeQuestionRoute({
    description: match.group.translations[locale].description,
    kind: "exercise-question",
    locale,
    materialKey: match.material.key,
    order: questionNumber,
    parentPath: setPath,
    publicPath: `${setPath}/${match.parts.question}`,
    sectionKey: `question-${questionNumber}`,
    sitemap: true,
    sourcePath,
    title: getExerciseQuestionRouteTitle({
      locale,
      number: questionNumber,
      setTitle: match.set.translations[locale].title,
    }),
  });
}

/** Reads a virtual question route by source asset path during SSG and metadata generation. */
export function readPublicPracticeQuestionRouteBySourcePath({
  domains,
  locale,
  materials,
  sourcePath,
}: {
  domains: NonNullable<RouteInputs["domains"]>;
  locale: Locale;
  materials: NonNullable<RouteInputs["materials"]>;
  sourcePath: string;
}): PublicPracticeQuestionRoute | undefined {
  for (const material of materials) {
    if (!isPracticeMaterialSource(material)) {
      continue;
    }

    const parts = readSourcePracticePathParts({
      assetRoot: material.assetRoot,
      sourcePath,
    });

    if (!parts?.question) {
      continue;
    }

    for (const group of material.groups) {
      if (parts.group !== getPracticeSourceGroupSlug(group)) {
        continue;
      }

      for (const set of group.sets) {
        const questionNumber = readSourcePracticeQuestionNumber(parts.question);

        if (parts.set !== set.slug || questionNumber === null) {
          continue;
        }

        const namespace = readNamespaceSegment("exercises", locale);
        const domainSlug = readDomainSlug(
          domains,
          "practice",
          material.domain,
          locale
        );

        if (!(namespace && domainSlug)) {
          continue;
        }

        const setPath = [
          namespace,
          material.assessment,
          domainSlug,
          toPublicPracticeGroupSegment(group, locale),
          set.routeSlugs[locale],
        ].join("/");
        const publicPath = [
          setPath,
          toPublicPracticeQuestionSegment({ locale, number: questionNumber }),
        ].join("/");

        const canonicalSourcePath = [
          material.assetRoot,
          getPracticeSourceGroupSlug(group),
          set.slug,
          questionNumber.toString(),
        ].join("/");

        return decodePracticeQuestionRoute({
          description: group.translations[locale].description,
          kind: "exercise-question",
          locale,
          materialKey: material.key,
          order: questionNumber,
          parentPath: setPath,
          publicPath,
          sectionKey: parts.question,
          sitemap: true,
          sourcePath: canonicalSourcePath,
          title: getExerciseQuestionRouteTitle({
            locale,
            number: questionNumber,
            setTitle: set.translations[locale].title,
          }),
        });
      }
    }
  }

  return;
}

/** Decodes a virtual practice question row through the public route schema. */
function decodePracticeQuestionRoute(route: unknown) {
  return Option.getOrUndefined(
    Schema.decodeUnknownOption(PublicPracticeQuestionRouteSchema)(route)
  );
}
