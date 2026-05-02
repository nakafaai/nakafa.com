import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getExerciseQuestionNumbers } from "@repo/contents/_lib/exercises/collection";
import { getExerciseContent } from "@repo/contents/_lib/exercises/content";
import {
  loadExerciseEntry,
  readExerciseChoices,
} from "@repo/contents/_lib/exercises/source";
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
      getExerciseContent(locale, questionPath, { includeMDX }).pipe(
        Effect.mapError(
          () =>
            new ExerciseLoadError({
              path: questionPath,
              reason: "Failed to load question",
            })
        )
      ),
    loadAnswer: (answerPath) =>
      getExerciseContent(locale, answerPath, { includeMDX }).pipe(
        Effect.mapError(
          () =>
            new ExerciseLoadError({
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

      return Option.some({
        answer: {
          metadata: answer.metadata,
          default: "default" in answer ? answer.default : undefined,
          raw: answer.raw,
        },
        choices,
        number,
        question: {
          metadata: question.metadata,
          default: "default" in question ? question.default : undefined,
          raw: question.raw,
        },
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
    const sortedQuestionNumbers = getExerciseQuestionNumbers(
      getMDXSlugsForLocale(locale),
      cleanPath
    );

    if (sortedQuestionNumbers.length === 0) {
      return [];
    }

    const exercises = yield* Effect.all(
      sortedQuestionNumbers.map((numberSegment) =>
        loadExercise(numberSegment, cleanPath, locale, includeMDX)
      )
    );

    return exercises
      .filter(Option.isSome)
      .map((option) => option.value)
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
    const exerciseNumberSegment = getExerciseQuestionNumbers(
      getMDXSlugsForLocale(locale),
      cleanPath
    ).find(
      (numberSegment) => Number.parseInt(numberSegment, 10) === exerciseNumber
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
