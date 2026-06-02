import { getFolderChildNames } from "@repo/contents/_lib/fs/cache";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";

const NUMBER_REGEX = /^\d+$/;
const EXERCISE_CONTENT_SEGMENTS = new Set(["_question", "_answer"]);

/**
 * Returns whether one path segment is a supported exercise content directory.
 *
 * @param value - Path segment to validate
 * @returns True when the segment is `_question` or `_answer`
 */
function isExerciseContentSegment(value: string) {
  return EXERCISE_CONTENT_SEGMENTS.has(value);
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
    const numberSegment = Option.fromNullable(pathParts.at(0));
    const contentSegment = Option.fromNullable(pathParts.at(1));

    if (
      pathParts.length >= 2 &&
      Option.isSome(numberSegment) &&
      Option.isSome(contentSegment) &&
      NUMBER_REGEX.test(numberSegment.value) &&
      isExerciseContentSegment(contentSegment.value)
    ) {
      questionNumbers.add(numberSegment.value);
    }
  }

  return Array.from(questionNumbers).sort(
    (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
  );
}

/**
 * Extracts unique exercise-set paths from already loaded exercise slugs.
 *
 * This lets callers that already hold the locale slug list avoid reading the
 * MDX cache again while keeping the same set-level path rules in one place.
 *
 * @param slugs - Cached MDX slugs for one locale
 * @returns Sorted list of unique exercise set paths
 */
export function getExerciseSetPathsFromSlugs(slugs: readonly string[]) {
  const setPaths = new Set<string>();

  for (const slug of slugs) {
    const pathParts = cleanSlug(slug).split("/");

    if (pathParts.length < 2) {
      continue;
    }

    const numberSegment = Option.fromNullable(pathParts.at(-2));
    const contentSegment = Option.fromNullable(pathParts.at(-1));

    if (
      Option.isNone(numberSegment) ||
      !NUMBER_REGEX.test(numberSegment.value)
    ) {
      continue;
    }

    if (
      Option.isNone(contentSegment) ||
      !isExerciseContentSegment(contentSegment.value)
    ) {
      continue;
    }

    setPaths.add(pathParts.slice(0, -2).join("/"));
  }

  return [...setPaths].sort();
}
