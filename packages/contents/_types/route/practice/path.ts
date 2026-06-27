import type { Locale } from "@repo/contents/_types/content";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import { getExerciseQuestionNumberSegment } from "@repo/contents/_types/graph/route";
import type { PracticeMaterialGroup } from "@repo/contents/_types/material/schema";
import type {
  PublicContentRoute,
  PublicPracticeQuestionRoute,
} from "@repo/contents/_types/route/schema";
import { locales } from "@repo/utilities/locales";

const PUBLIC_PRACTICE_QUESTION_SEGMENTS = {
  en: "question",
  id: "soal",
} satisfies { readonly [locale in Locale]: string };

/** Builds the localized public practice group segment without splitting year. */
export function toPublicPracticeGroupSegment(
  group: Pick<PracticeMaterialGroup, "routeSlugs" | "year">,
  locale: Locale
) {
  const slug = group.routeSlugs[locale];

  return group.year === undefined ? slug : `${slug}-${group.year}`;
}

type PracticeDomainRouteInput =
  | Pick<
      Extract<PublicContentRoute, { kind: "exercise-set" }>,
      "kind" | "publicPath"
    >
  | Pick<PublicPracticeQuestionRoute, "kind" | "publicPath">;

/** Reads the rendered practice assessment root path from a concrete set or question row. */
export function readPublicPracticeAssessmentPath(
  route: PracticeDomainRouteInput
) {
  return route.publicPath.split("/").slice(0, 2).join("/");
}

/** Reads the rendered practice domain path from a concrete set or question row. */
export function readPublicPracticeDomainPath(route: PracticeDomainRouteInput) {
  const segments = route.publicPath.split("/");
  const droppedSegments = route.kind === "exercise-question" ? 3 : 2;

  return segments.slice(0, -droppedSegments).join("/");
}

/** Reads the source asset folder for one practice material group. */
export function getPracticeSourceGroupSlug(group: PracticeMaterialGroup) {
  return group.year === undefined
    ? group.exerciseType
    : `${group.exerciseType}-${group.year}`;
}

/** Reads the source-owned group identity from a single practice group folder. */
export function readPracticeSourceGroupIdentity(group: string) {
  const separatorIndex = group.lastIndexOf("-");

  if (separatorIndex <= 0) {
    return { exerciseType: group };
  }

  const rawYear = group.slice(separatorIndex + 1);
  const year = Number.parseInt(rawYear, 10);

  if (
    rawYear.length !== 4 ||
    !Number.isSafeInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    year.toString() !== rawYear
  ) {
    return { exerciseType: group };
  }

  return {
    exerciseType: group.slice(0, separatorIndex),
    year: rawYear,
  };
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

  const prefix = `${PUBLIC_PRACTICE_QUESTION_SEGMENTS[locale]}-`;

  if (!segment.startsWith(prefix)) {
    return null;
  }

  const rawValue = segment.slice(prefix.length);
  const value = Number.parseInt(rawValue, 10);

  return Number.isInteger(value) && value > 0 && value.toString() === rawValue
    ? value
    : null;
}

/** Parses source-owned practice question segments from material API and projection paths. */
export function readSourcePracticeQuestionNumber(segment: string | undefined) {
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

/** Resolves source practice set and question paths to the persisted runtime slug shape. */
export function readSourcePracticeRoutePath(sourcePath: string) {
  const projection = getSourceRouteProjectionForRoute(sourcePath);

  if (projection?.kind === "exercise-set") {
    return {
      kind: "set" as const,
      sourcePath: projection.route,
    };
  }

  if (!(projection?.kind === "exercise-question" && projection.exercise)) {
    return;
  }

  const questionNumber = projection.learningObjectSegments.slice(-1).join("");

  return {
    kind: "question" as const,
    sourcePath: `${projection.parentRoute}/${questionNumber}`,
  };
}

/**
 * Checks whether a path ends with a known practice question leaf.
 *
 * Search and preview callers use this route-owned predicate instead of keeping
 * their own public/source question suffix grammar.
 */
export function isPracticeQuestionPath(path: string) {
  const segment = path.split("/").at(-1);

  if (readSourcePracticeQuestionNumber(segment) !== null) {
    return true;
  }

  return locales.some(
    (locale) => readPublicPracticeQuestionNumber({ locale, segment }) !== null
  );
}

/** Builds the locale-owned public practice question segment for a positive number. */
export function toPublicPracticeQuestionSegment({
  locale,
  number,
}: {
  locale: Locale;
  number: number;
}) {
  return `${PUBLIC_PRACTICE_QUESTION_SEGMENTS[locale]}-${number}`;
}

/** Parses a localized public practice set or question path into named route parts. */
export function readPublicPracticePathParts(publicPath: string) {
  const [namespace, assessment, domain, group, set, question, ...extra] =
    publicPath.split("/").filter(Boolean);

  if (!(namespace && assessment && domain && group && set)) {
    return;
  }

  if (extra.length > 0) {
    return;
  }

  return { assessment, domain, group, namespace, question, set };
}

/** Parses a source practice set or question path into named asset parts. */
export function readSourcePracticePathParts({
  assetRoot,
  sourcePath,
}: {
  assetRoot: string;
  sourcePath: string;
}) {
  if (!sourcePath.startsWith(`${assetRoot}/`)) {
    return;
  }

  const [group, set, question, ...extra] = sourcePath
    .slice(assetRoot.length + 1)
    .split("/")
    .filter(Boolean);

  if (!(group && set)) {
    return;
  }

  if (extra.length > 0) {
    return;
  }

  return { group, question, set };
}
