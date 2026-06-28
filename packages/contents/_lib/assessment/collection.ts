import { cleanSlug } from "@repo/utilities/helper";
import { Option } from "effect";

const QUESTION_SEGMENT_REGEX = /^question-(\d+)$/;
const EXERCISE_CONTENT_SEGMENTS = new Set(["question", "answer"]);

/** Parses the numeric question ordinal from a `question-N` folder segment. */
export function getExerciseQuestionNumber(questionSegment: string) {
  const match = QUESTION_SEGMENT_REGEX.exec(questionSegment);

  if (!match?.[1]) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

/**
 * Returns whether one path segment is a supported exercise content directory.
 *
 * @param value - Path segment to validate
 * @returns True when the segment is `question` or `answer`
 */
function isExerciseContentSegment(value: string) {
  return EXERCISE_CONTENT_SEGMENTS.has(value);
}

/**
 * Extracts direct exercise numbers for one exercise set path.
 *
 * Exercise content is stored under question folders such as
 * `set-1/question-1/question` and `set-1/question-1/answer`. This helper only
 * accepts direct question folders followed by question or answer material, so
 * collection routes like `try-out-2026` are not misclassified as exercise pages.
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
    const questionSegment = Option.fromNullable(pathParts.at(0));
    const contentSegment = Option.fromNullable(pathParts.at(1));

    if (
      pathParts.length >= 2 &&
      Option.isSome(questionSegment) &&
      Option.isSome(contentSegment) &&
      QUESTION_SEGMENT_REGEX.test(questionSegment.value) &&
      isExerciseContentSegment(contentSegment.value)
    ) {
      questionNumbers.add(questionSegment.value);
    }
  }

  return Array.from(questionNumbers).sort(
    (a, b) =>
      Number.parseInt(a.slice("question-".length), 10) -
      Number.parseInt(b.slice("question-".length), 10)
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

    const questionSegment = Option.fromNullable(pathParts.at(-2));
    const contentSegment = Option.fromNullable(pathParts.at(-1));

    if (
      Option.isNone(questionSegment) ||
      !QUESTION_SEGMENT_REGEX.test(questionSegment.value)
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

  return Array.from(setPaths).sort();
}
