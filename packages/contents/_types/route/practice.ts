import { ExercisesMaterialSchema } from "@repo/contents/_types/assessment/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/assessment/type";
import type { Locale } from "@repo/contents/_types/content";
import { getExerciseQuestionNumberSegment } from "@repo/contents/_types/graph/route";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import type {
  MaterialSource,
  PracticeMaterialGroup,
  PracticeMaterialSource,
} from "@repo/contents/_types/material/schema";
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

/** Narrows unified material sources to practice material sources. */
export function isPracticeMaterialSource(
  material: MaterialSource
): material is PracticeMaterialSource {
  return material.kind === "practice";
}

/** Builds one canonical public practice group path from source-owned route slugs. */
export function makePracticeGroupPath({
  domains,
  group,
  locale,
  material,
}: {
  domains: NonNullable<RouteInputs["domains"]>;
  group: PracticeMaterialGroup;
  locale: Locale;
  material: Pick<PracticeMaterialSource, "assessment" | "domain">;
}) {
  return Effect.gen(function* () {
    return yield* makePath([
      yield* lookupNamespaceSegment("exercises", locale),
      material.assessment,
      yield* lookupDomainSlug(domains, "practice", material.domain, locale),
      ...getPracticeActivitySegments(group, locale),
    ]);
  });
}

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
    ...getPracticeActivitySegments(group, decoded.locale),
    decoded.setName,
    decoded.locale === "id"
      ? `soal-${decoded.number}`
      : `question-${decoded.number}`,
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
  const pathSegments = publicPath.split("/").filter(Boolean);
  const namespace = readNamespaceSegment("exercises", locale);

  if (!namespace || pathSegments[0] !== namespace) {
    return;
  }

  for (const material of materials) {
    if (!isPracticeMaterialSource(material)) {
      continue;
    }

    const domainSlug = readDomainSlug(
      domains,
      "practice",
      material.domain,
      locale
    );

    if (
      !domainSlug ||
      pathSegments[1] !== material.assessment ||
      pathSegments[2] !== domainSlug
    ) {
      continue;
    }

    for (const group of material.groups) {
      const groupSegments = getPracticeActivitySegments(group, locale);

      if (!segmentsMatch(pathSegments.slice(3), groupSegments)) {
        continue;
      }

      for (const set of group.sets) {
        const setIndex = 3 + groupSegments.length;
        const questionIndex = setIndex + 1;
        const questionNumber = readPublicPracticeQuestionNumber({
          locale,
          segment: pathSegments[questionIndex],
        });

        if (
          pathSegments[setIndex] !== set.routeSlugs[locale] ||
          pathSegments.length !== questionIndex + 1 ||
          questionNumber === null
        ) {
          continue;
        }

        const setPath = [
          namespace,
          material.assessment,
          domainSlug,
          ...groupSegments,
          set.routeSlugs[locale],
        ].join("/");
        const questionPath = `${setPath}/${pathSegments[questionIndex]}`;
        const sourcePath = [
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
          publicPath: questionPath,
          sectionKey: `question-${questionNumber}`,
          sitemap: true,
          sourcePath,
          title:
            locale === "id"
              ? `${set.translations[locale].title} Soal ${questionNumber}`
              : `${set.translations[locale].title} Question ${questionNumber}`,
        });
      }
    }
  }

  return;
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

    if (!sourcePath.startsWith(`${material.assetRoot}/`)) {
      continue;
    }

    const pathSegments = sourcePath
      .slice(material.assetRoot.length + 1)
      .split("/")
      .filter(Boolean);

    for (const group of material.groups) {
      if (pathSegments[0] !== getPracticeSourceGroupSlug(group)) {
        continue;
      }

      for (const set of group.sets) {
        const questionNumber = readSourceQuestionNumber(pathSegments[2]);

        if (
          pathSegments[1] !== set.slug ||
          pathSegments.length !== 3 ||
          questionNumber === null
        ) {
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
          ...getPracticeActivitySegments(group, locale),
          set.routeSlugs[locale],
        ].join("/");
        const publicPath = [
          setPath,
          locale === "id"
            ? `soal-${questionNumber}`
            : `question-${questionNumber}`,
        ].join("/");

        return decodePracticeQuestionRoute({
          description: group.translations[locale].description,
          kind: "exercise-question",
          locale,
          materialKey: material.key,
          order: questionNumber,
          parentPath: setPath,
          publicPath,
          sectionKey: pathSegments[2],
          sitemap: true,
          sourcePath,
          title:
            locale === "id"
              ? `${set.translations[locale].title} Soal ${questionNumber}`
              : `${set.translations[locale].title} Question ${questionNumber}`,
        });
      }
    }
  }

  return;
}

/** Reads the activity and year route segments from a decoded practice group. */
export function getPracticeActivitySegments(
  group: Pick<PracticeMaterialGroup, "routeSlugs" | "year">,
  locale: Locale
) {
  if (group.year === undefined) {
    return [group.routeSlugs[locale]];
  }

  return [group.routeSlugs[locale], group.year.toString()];
}

/** Reads the source asset folder for one practice material group. */
export function getPracticeSourceGroupSlug(group: PracticeMaterialGroup) {
  return group.year === undefined
    ? group.exerciseType
    : `${group.exerciseType}-${group.year}`;
}

/** Indexes practice materials by stable material key for assessment projection. */
export function createPracticeMaterialByKey(
  materials: NonNullable<RouteInputs["materials"]>
) {
  const entries: [PracticeMaterialSource["key"], PracticeMaterialSource][] = [];

  for (const material of materials) {
    if (isPracticeMaterialSource(material)) {
      entries.push([material.key, material]);
    }
  }

  return new Map(entries);
}

/** Compares public path prefixes without accepting reordered practice segments. */
function segmentsMatch(actual: readonly string[], expected: readonly string[]) {
  return expected.every((segment, index) => actual[index] === segment);
}

/** Parses localized public question segments while rejecting malformed or non-positive question numbers. */
export function readPublicPracticeQuestionNumber({
  locale,
  segment,
}: {
  locale: Locale;
  segment: string | undefined;
}) {
  if (!segment) {
    return null;
  }

  const prefix = locale === "id" ? "soal-" : "question-";

  if (!segment.startsWith(prefix)) {
    return null;
  }

  const rawValue = segment.slice(prefix.length);
  const value = Number.parseInt(rawValue, 10);

  return Number.isInteger(value) && value > 0 && value.toString() === rawValue
    ? value
    : null;
}

/** Parses source-owned exercise question segments from synced material rows. */
function readSourceQuestionNumber(segment: string | undefined) {
  if (!segment) {
    return null;
  }

  const rawValue = getExerciseQuestionNumberSegment(segment);

  if (!rawValue) {
    return null;
  }

  const value = Number.parseInt(rawValue, 10);

  return value > 0 ? value : null;
}

/** Decodes a virtual practice question row through the public route schema. */
function decodePracticeQuestionRoute(route: unknown) {
  return Option.getOrUndefined(
    Schema.decodeUnknownOption(PublicPracticeQuestionRouteSchema)(route)
  );
}
