import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getExerciseQuestionNumbers } from "@repo/contents/_lib/exercises/collection";
import {
  loadExerciseEntry,
  readExerciseChoices,
  readExerciseContentData,
} from "@repo/contents/_lib/exercises/source";
import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";

/**
 * Loads one plain exercise row from raw MDX metadata and parsed choices.
 *
 * @param exerciseNumberSegment - Numbered folder name inside the exercise set
 * @param cleanPath - Normalized exercise-set path relative to `packages/contents`
 * @param locale - Locale used to resolve the exercise content files
 * @returns Plain exercise row, or `null` when any required source is missing
 */
function loadRenderableExercise(
  exerciseNumberSegment: string,
  cleanPath: string,
  locale: Locale
) {
  return loadExerciseEntry(cleanPath, exerciseNumberSegment, {
    loadQuestion: (questionPath) =>
      readExerciseContentData(locale, questionPath),
    loadAnswer: (answerPath) => readExerciseContentData(locale, answerPath),
    loadChoices: (choicesPath) =>
      readExerciseChoices(choicesPath).pipe(
        Effect.catchTags({
          GitHubFetchError: () => Effect.succeed(null),
          InvalidPathError: () => Effect.succeed(null),
        })
      ),
  }).pipe(
    Effect.map((exercise) => {
      if (Option.isNone(exercise)) {
        return null;
      }

      return exercise.value;
    })
  );
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

  return await Effect.runPromise(
    Effect.all(
      exerciseNumbers.map((exerciseNumber) =>
        loadRenderableExercise(exerciseNumber, cleanPath, locale)
      ),
      { concurrency: "unbounded" }
    ).pipe(
      Effect.map((exercises) =>
        exercises.filter((exercise) => exercise !== null)
      )
    )
  );
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

  return Effect.runPromise(
    loadRenderableExercise(numberSegment, cleanPath, locale)
  );
}
