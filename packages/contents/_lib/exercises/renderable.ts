import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getExerciseQuestionNumbers } from "@repo/contents/_lib/exercises/collection";
import {
  getExerciseEntryPaths,
  readExerciseChoices,
  readExerciseContentData,
} from "@repo/contents/_lib/exercises/source";
import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";

/**
 * Loads one plain exercise row from raw MDX metadata and parsed choices.
 *
 * @param exerciseNumberSegment - Numbered folder name inside the exercise set
 * @param cleanPath - Normalized exercise-set path relative to `packages/contents`
 * @param locale - Locale used to resolve the exercise content files
 * @returns Plain exercise row, or `null` when any required source is missing
 */
async function loadRenderableExercise(
  exerciseNumberSegment: string,
  cleanPath: string,
  locale: Locale
) {
  const exerciseNumber = Number.parseInt(exerciseNumberSegment, 10);
  const { answerPath, choicesPath, questionPath } = getExerciseEntryPaths(
    cleanPath,
    exerciseNumberSegment
  );

  const [question, answer, choices] = await Promise.all([
    readExerciseContentData(locale, questionPath),
    readExerciseContentData(locale, answerPath),
    readExerciseChoices(choicesPath).catch(() => null),
  ]);

  if (!(question && answer && choices)) {
    return null;
  }

  return {
    answer,
    choices,
    number: exerciseNumber,
    question,
  };
}

/**
 * Loads the plain renderable exercise rows for one exercise set without
 * importing compiled MDX modules.
 *
 * @param locale - Locale whose exercise set should be loaded
 * @param filePath - Exercise-set path relative to `packages/contents`
 * @returns Plain exercise rows ordered by exercise number
 */
export async function getRenderableExercisesContent(
  locale: Locale,
  filePath: string
) {
  const cleanPath = cleanSlug(filePath);
  const exerciseNumbers = getExerciseQuestionNumbers(
    getMDXSlugsForLocale(locale),
    cleanPath
  );

  if (exerciseNumbers.length === 0) {
    return [];
  }

  const exercises = await Promise.all(
    exerciseNumbers.map((exerciseNumber) =>
      loadRenderableExercise(exerciseNumber, cleanPath, locale)
    )
  );

  return exercises.filter((exercise) => exercise !== null);
}

/**
 * Loads one plain renderable exercise row by its number within an exercise set.
 *
 * @param locale - Locale whose exercise set should be loaded
 * @param filePath - Exercise-set path relative to `packages/contents`
 * @param exerciseNumber - Exercise number to look up
 * @returns Matching plain exercise row, or `null` when it is unavailable
 */
export function getRenderableExerciseByNumber(
  locale: Locale,
  filePath: string,
  exerciseNumber: number
) {
  const cleanPath = cleanSlug(filePath);
  const numberSegment = getExerciseQuestionNumbers(
    getMDXSlugsForLocale(locale),
    cleanPath
  ).find((segment) => Number.parseInt(segment, 10) === exerciseNumber);

  if (!numberSegment) {
    return null;
  }

  return loadRenderableExercise(numberSegment, cleanPath, locale);
}
