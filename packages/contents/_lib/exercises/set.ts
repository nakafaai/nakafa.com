import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getExerciseQuestionNumbers } from "@repo/contents/_lib/exercises/collection";
import { getExerciseContent } from "@repo/contents/_lib/exercises/content";
import {
  getExerciseEntryPaths,
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
 * Loads one localized exercise content fragment through the scoped exercises
 * MDX loader.
 *
 * @param locale - Locale used to resolve the content fragment
 * @param filePath - Exercise question or answer path relative to `packages/contents`
 * @param includeMDX - Whether to include the compiled MDX component
 * @returns Effect resolving to the content fragment
 */
function loadExerciseContentFragment(
  locale: Locale,
  filePath: string,
  includeMDX: boolean
) {
  return getExerciseContent(locale, filePath, { includeMDX });
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
  return Effect.gen(function* () {
    const exerciseNumber = Number.parseInt(exerciseNumberSegment, 10);
    const { answerPath, choicesPath, questionPath } = getExerciseEntryPaths(
      cleanPath,
      exerciseNumberSegment
    );

    const [questionContent, answerContent, choicesData] = yield* Effect.all(
      [
        loadExerciseContentFragment(locale, questionPath, includeMDX).pipe(
          Effect.mapError(
            () =>
              new ExerciseLoadError({
                path: questionPath,
                reason: "Failed to load question",
              })
          )
        ),
        loadExerciseContentFragment(locale, answerPath, includeMDX).pipe(
          Effect.mapError(
            () =>
              new ExerciseLoadError({
                path: answerPath,
                reason: "Failed to load answer",
              })
          )
        ),
        Effect.tryPromise({
          try: () => readExerciseChoices(choicesPath),
          catch: () =>
            new ExerciseLoadError({
              path: choicesPath,
              reason: "Failed to load choices",
            }),
        }),
      ],
      { concurrency: "unbounded" }
    );

    if (!(questionContent && answerContent && choicesData)) {
      return Option.none();
    }

    return Option.some({
      number: exerciseNumber,
      choices: choicesData,
      question: {
        metadata: questionContent.metadata,
        default:
          "default" in questionContent ? questionContent.default : undefined,
        raw: questionContent.raw,
      },
      answer: {
        metadata: answerContent.metadata,
        default: "default" in answerContent ? answerContent.default : undefined,
        raw: answerContent.raw,
      },
    });
  });
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
