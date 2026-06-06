import {
  EXERCISE_NUMBER_REGEX,
  EXERCISE_SET_REGEX,
} from "@repo/contents/_lib/manifest/constants";

/** Extracts unique exercise set paths from cached MDX entries. */
export function getExerciseSetPaths(slugs: readonly string[]) {
  const exerciseSets = new Set<string>();

  for (const slug of slugs) {
    const match = slug.match(EXERCISE_SET_REGEX);
    if (match?.[1]) {
      exerciseSets.add(match[1]);
    }
  }

  return Array.from(exerciseSets);
}

/** Extracts unique exercise number paths from cached MDX entries. */
export function getExerciseNumberPaths(slugs: readonly string[]) {
  const exerciseNumbers = new Set<string>();

  for (const slug of slugs) {
    const match = slug.match(EXERCISE_NUMBER_REGEX);
    if (match?.[1]) {
      exerciseNumbers.add(match[1]);
    }
  }

  return Array.from(exerciseNumbers);
}
