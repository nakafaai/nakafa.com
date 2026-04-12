import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getFolderChildNames } from "@repo/contents/_lib/fs";
import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect } from "effect";

const NUMBER_REGEX = /^\d+$/;
const EXERCISE_CONTENT_SEGMENTS = new Set(["_question", "_answer"]);

/**
 * Returns whether one path segment is a supported exercise content directory.
 *
 * @param value - Path segment to validate
 * @returns True when the segment is `_question` or `_answer`
 */
function isExerciseContentSegment(value: string | undefined) {
  return value !== undefined && EXERCISE_CONTENT_SEGMENTS.has(value);
}

/**
 * Counts the numbered exercise folders that exist under one exercise set path.
 *
 * @param filePath - Exercise set path relative to `packages/contents`
 * @returns Effect that resolves to the number of exercise folders in the set
 */
export function getExerciseCount(filePath: string) {
  return Effect.gen(function* () {
    const cleanPath = cleanSlug(filePath);
    const childNames = yield* getFolderChildNames(cleanPath).pipe(
      Effect.orElse(() => Effect.succeed([]))
    );

    return childNames.filter((name) => NUMBER_REGEX.test(name)).length;
  });
}

/**
 * Extracts direct exercise numbers for one exercise set path.
 *
 * Exercise content is stored under numbered folders such as
 * `set-1/1/_question` and `set-1/1/_answer`. This helper only accepts direct
 * number segments followed by `_question` or `_answer`, so collection routes
 * like `try-out/2026` are not misclassified as exercise pages.
 *
 * @param slugs - Cached MDX slugs for one locale
 * @param filePath - Exercise set path relative to `packages/contents`
 * @returns Sorted list of unique exercise numbers found under the set path
 */
export function getExerciseQuestionNumbers(
  slugs: readonly string[],
  filePath: string
) {
  const cleanPath = cleanSlug(filePath);
  const exercisePathPrefix = cleanPath === "" ? "" : `${cleanPath}/`;
  const questionNumbers = new Set<string>();

  for (const slug of slugs) {
    if (!slug.startsWith(exercisePathPrefix)) {
      continue;
    }

    const remainingPath = slug.slice(exercisePathPrefix.length);
    const pathParts = remainingPath.split("/");

    if (
      pathParts.length >= 2 &&
      NUMBER_REGEX.test(pathParts[0]) &&
      isExerciseContentSegment(pathParts[1])
    ) {
      questionNumbers.add(pathParts[0]);
    }
  }

  return Array.from(questionNumbers).sort(
    (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
  );
}

/**
 * Extracts unique exercise-set paths for one locale from cached exercise slugs.
 *
 * Exercise content is stored as numbered folders containing `_question` or
 * `_answer` entries. This helper strips the trailing number/content segments so
 * callers can work at the set level without re-encoding path rules.
 *
 * @param locale - Locale whose cached exercise slugs should be scanned
 * @returns Sorted list of unique exercise set paths
 */
export function getExerciseSetPaths(locale: Locale) {
  const setPaths = new Set<string>();

  for (const slug of getMDXSlugsForLocale(locale)) {
    const pathParts = cleanSlug(slug).split("/");

    if (pathParts.length < 2) {
      continue;
    }

    const [numberSegment, contentSegment] = pathParts.slice(-2);

    if (!NUMBER_REGEX.test(numberSegment)) {
      continue;
    }

    if (!isExerciseContentSegment(contentSegment)) {
      continue;
    }

    setPaths.add(pathParts.slice(0, -2).join("/"));
  }

  return [...setPaths].sort();
}
