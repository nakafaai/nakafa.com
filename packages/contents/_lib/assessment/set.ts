import {
  getExerciseQuestionNumber,
  getExerciseQuestionNumbers,
} from "@repo/contents/_lib/assessment/collection";
import {
  loadExerciseEntry,
  readExerciseChoices,
} from "@repo/contents/_lib/assessment/source";
import { getMdxSlugsForLocale } from "@repo/contents/_lib/mdx-slugs/cache";
import { getScopedContent } from "@repo/contents/_lib/scoped";
import { ExerciseLoadError } from "@repo/contents/_shared/error";
import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";

/**
 * Options for loading one exercise set from the contents package.
 */
export interface ExerciseContentOptions {
  filePath: string;
  includeMDX?: boolean;
  locale: Locale;
}

/**
 * Loads one exercise row from its numbered directory inside a set.
 *
 * @param exerciseNumberSegment - Numbered folder name inside the exercise set
 * @param cleanPath - Normalized exercise-set path relative to `packages/contents`
 * @param locale - Locale used to load question and answer content
 * @param includeMDX - Whether to include compiled MDX components in the result
 * @returns Effect that resolves to an exercise or `Option.none()` when incomplete
 */
function loadExercise(
  exerciseNumberSegment: string,
  cleanPath: string,
  locale: Locale,
  includeMDX: boolean
) {
  return loadExerciseEntry(cleanPath, exerciseNumberSegment, {
    loadQuestion: (questionPath) =>
      getScopedContent("material", locale, questionPath, { includeMDX }).pipe(
        Effect.map(Option.some),
        Effect.mapError(
          () =>
            new ExerciseLoadError({
              message: "Unable to load exercise question.",
              path: questionPath,
              reason: "Failed to load question",
            })
        )
      ),
    loadAnswer: (answerPath) =>
      getScopedContent("material", locale, answerPath, { includeMDX }).pipe(
        Effect.map(Option.some),
        Effect.mapError(
          () =>
            new ExerciseLoadError({
              message: "Unable to load exercise answer.",
              path: answerPath,
              reason: "Failed to load answer",
            })
        )
      ),
    loadChoices: (choicesPath) =>
      readExerciseChoices(choicesPath).pipe(
        Effect.mapError(
          () =>
            new ExerciseLoadError({
              message: "Unable to load exercise choices.",
              path: choicesPath,
              reason: "Failed to load choices",
            })
        )
      ),
  }).pipe(
    Effect.map((exercise) => {
      if (Option.isNone(exercise)) {
        return Option.none();
      }

      const { answer, choices, number, question } = exercise.value;
      const answerContent = {
        metadata: answer.metadata,
        raw: answer.raw,
        ...("default" in answer ? { default: answer.default } : {}),
      };
      const questionContent = {
        metadata: question.metadata,
        raw: question.raw,
        ...("default" in question ? { default: question.default } : {}),
      };

      return Option.some({
        answer: answerContent,
        choices,
        number,
        question: questionContent,
      });
    })
  );
}

/**
 * Retrieves all exercises for one exercise set.
 *
 * @param options - Exercise-set retrieval options
 * @returns Effect that resolves to exercises sorted by number
 */
export function getExercisesContent(options: ExerciseContentOptions) {
  return Effect.gen(function* () {
    const { includeMDX = true, locale, filePath } = options;
    const cleanPath = cleanSlug(filePath);
    const slugs = yield* getMdxSlugsForLocale(locale);
    const sortedQuestionNumbers = getExerciseQuestionNumbers(slugs, cleanPath);

    if (sortedQuestionNumbers.length === 0) {
      return [];
    }

    const exercises = yield* Effect.all(
      sortedQuestionNumbers.map((numberSegment) =>
        loadExercise(numberSegment, cleanPath, locale, includeMDX)
      )
    );

    return exercises
      .flatMap((exercise) => (Option.isSome(exercise) ? [exercise.value] : []))
      .sort((a, b) => a.number - b.number);
  });
}

/**
 * Retrieves one exercise by number from an exercise set.
 *
 * @param locale - Locale used to resolve the exercise set
 * @param filePath - Exercise-set path relative to `packages/contents`
 * @param exerciseNumber - Exercise number to look up
 * @param includeMDX - Whether to include compiled MDX components
 * @returns Effect that resolves to the matching exercise or `Option.none()`
 */
export function getExerciseByNumber(
  locale: Locale,
  filePath: string,
  exerciseNumber: number,
  includeMDX = true
) {
  return Effect.gen(function* () {
    const cleanPath = cleanSlug(filePath);
    const slugs = yield* getMdxSlugsForLocale(locale);
    const exerciseNumberSegment = getExerciseQuestionNumbers(
      slugs,
      cleanPath
    ).find(
      (numberSegment) =>
        getExerciseQuestionNumber(numberSegment) === exerciseNumber
    );

    if (!exerciseNumberSegment) {
      return Option.none();
    }

    return yield* loadExercise(
      exerciseNumberSegment,
      cleanPath,
      locale,
      includeMDX
    );
  });
}
