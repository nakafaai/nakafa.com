import { getExerciseQuestionNumbers } from "@repo/contents/_lib/exercises/collection";
import {
  loadExerciseEntry,
  readExerciseChoices,
  readExerciseContentData,
} from "@repo/contents/_lib/exercises/source";
import { getMdxSlugsForLocale } from "@repo/contents/_lib/mdx-slugs/cache";
import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";

/**
 * Loads one plain exercise row from raw MDX metadata and parsed choices.
 *
 * @param exerciseNumberSegment - Numbered folder name inside the exercise set
 * @param cleanPath - Normalized exercise-set path relative to `packages/contents`
 * @param locale - Locale used to resolve the exercise content files
 * @returns Plain exercise row when every required source is present
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
          GitHubFetchError: () => Effect.succeed(Option.none()),
          InvalidPathError: () => Effect.succeed(Option.none()),
        })
      ),
  }).pipe(
    Effect.map((exercise) => {
      if (Option.isNone(exercise)) {
        return Option.none();
      }

      return Option.some(exercise.value);
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
export const getRenderableExercisesContent = Effect.fn(
  "Contents.Exercises.getRenderableExercisesContent"
)(function* (locale: Locale, filePath: string) {
  const cleanPath = cleanSlug(filePath);
  const slugs = yield* getMdxSlugsForLocale(locale);
  const exerciseNumbers = getExerciseQuestionNumbers(slugs, cleanPath);

  if (exerciseNumbers.length === 0) {
    return [];
  }

  return yield* Effect.all(
    exerciseNumbers.map((exerciseNumber) =>
      loadRenderableExercise(exerciseNumber, cleanPath, locale)
    ),
    { concurrency: "unbounded" }
  ).pipe(
    Effect.map((exercises) =>
      exercises.flatMap((exercise) =>
        Option.isSome(exercise) ? [exercise.value] : []
      )
    )
  );
});

/**
 * Loads one plain renderable exercise row by its number within an exercise set.
 *
 * @param locale - Locale whose exercise set should be loaded
 * @param filePath - Exercise-set path relative to `packages/contents`
 * @param exerciseNumber - Exercise number to look up
 * @returns Matching plain exercise row when it is available
 */
export const getRenderableExerciseByNumber = Effect.fn(
  "Contents.Exercises.getRenderableExerciseByNumber"
)(function* (locale: Locale, filePath: string, exerciseNumber: number) {
  const cleanPath = cleanSlug(filePath);
  const slugs = yield* getMdxSlugsForLocale(locale);
  const numberSegment = getExerciseQuestionNumbers(slugs, cleanPath).find(
    (segment) => Number.parseInt(segment, 10) === exerciseNumber
  );

  if (!numberSegment) {
    return Option.none();
  }

  return yield* loadRenderableExercise(numberSegment, cleanPath, locale);
});
