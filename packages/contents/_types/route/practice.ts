import { ExercisesMaterialSchema } from "@repo/contents/_types/assessment/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/assessment/type";
import type { Locale } from "@repo/contents/_types/content";
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
  decodeContentRoute,
  lookupDomainSlug,
  lookupNamespaceSegment,
  makePath,
} from "@repo/contents/_types/route/path";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
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

/** Locates a virtual question route by localized public path segments. */
export function findPublicPracticeQuestionRouteByPath({
  domains,
  locale,
  materials,
  publicPath,
}: {
  domains: NonNullable<RouteInputs["domains"]>;
  locale: Locale;
  materials: NonNullable<RouteInputs["materials"]>;
  publicPath: string;
}) {
  return Effect.gen(function* () {
    const pathSegments = publicPath.split("/").filter(Boolean);
    const namespace = yield* lookupNamespaceSegment("exercises", locale);

    if (pathSegments[0] !== namespace) {
      return Option.none<PublicContentRoute>();
    }

    for (const material of materials) {
      if (!isPracticeMaterialSource(material)) {
        continue;
      }

      const domainSlug = yield* lookupDomainSlug(
        domains,
        "practice",
        material.domain,
        locale
      );

      if (
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
          const questionNumber = readQuestionNumber(
            pathSegments[questionIndex],
            locale
          );

          if (
            pathSegments[setIndex] !== set.routeSlugs[locale] ||
            pathSegments.length !== questionIndex + 1 ||
            questionNumber === null
          ) {
            continue;
          }

          const setPath = yield* makePath([
            namespace,
            material.assessment,
            domainSlug,
            ...groupSegments,
            set.routeSlugs[locale],
          ]);
          const questionPath = yield* makePath([
            setPath,
            pathSegments[questionIndex],
          ]);
          const sourcePath = yield* makePath([
            material.assetRoot,
            getPracticeSourceGroupSlug(group),
            set.slug,
            `question-${questionNumber}`,
          ]);

          return Option.some(
            yield* decodeContentRoute({
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
            })
          );
        }
      }
    }

    return Option.none<PublicContentRoute>();
  });
}

/** Locates a virtual question route by source asset path. */
export function findPublicPracticeQuestionRouteBySourcePath({
  domains,
  locale,
  materials,
  sourcePath,
}: {
  domains: NonNullable<RouteInputs["domains"]>;
  locale: Locale;
  materials: NonNullable<RouteInputs["materials"]>;
  sourcePath: string;
}) {
  return Effect.gen(function* () {
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
          const questionNumber = readQuestionNumber(pathSegments[2], "en");

          if (
            pathSegments[1] !== set.slug ||
            pathSegments.length !== 3 ||
            questionNumber === null
          ) {
            continue;
          }

          const setPath = yield* makePath([
            yield* lookupNamespaceSegment("exercises", locale),
            material.assessment,
            yield* lookupDomainSlug(
              domains,
              "practice",
              material.domain,
              locale
            ),
            ...getPracticeActivitySegments(group, locale),
            set.routeSlugs[locale],
          ]);
          const publicPath = yield* makePath([
            setPath,
            locale === "id"
              ? `soal-${questionNumber}`
              : `question-${questionNumber}`,
          ]);

          return Option.some(
            yield* decodeContentRoute({
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
            })
          );
        }
      }
    }

    return Option.none<PublicContentRoute>();
  });
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

/** Parses localized question segments while rejecting malformed or non-positive question numbers. */
function readQuestionNumber(segment: string | undefined, locale: Locale) {
  if (!segment) {
    return null;
  }

  const prefix = locale === "id" ? "soal-" : "question-";

  if (!segment.startsWith(prefix)) {
    return null;
  }

  const value = Number.parseInt(segment.slice(prefix.length), 10);

  return Number.isInteger(value) && value > 0 ? value : null;
}
