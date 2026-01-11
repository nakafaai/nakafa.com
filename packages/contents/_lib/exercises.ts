import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import { getContent } from "@repo/contents/_lib/content";
import {
  type ChoicesValidationError,
  ExerciseLoadError,
} from "@repo/contents/_shared/error";
import { ExercisesChoicesSchema } from "@repo/contents/_types/exercises/choices";
import type { Exercise } from "@repo/contents/_types/exercises/shared";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";

const NUMBER_REGEX = /^\d+$/;

export interface ExerciseContentOptions {
  includeMDX?: boolean;
  locale: Locale;
  filePath: string;
}

/**
 * Retrieves all exercises for a given path, handling _question and _answer subdirectories.
 * Exercise sets are structured with numbered folders containing question/answer pairs.
 *
 * @param options - Exercise retrieval options
 * @param options.includeMDX - Whether to load MDX components (default: true)
 * @param options.locale - Target locale
 * @param options.filePath - Base path to exercise set (e.g., "exercises/high-school/tka/mathematics/try-out/set-1")
 * @returns Effect that produces array of exercises sorted by number, or Option.none() if no exercises found
 *
 * @example
 * ```ts
 * const exercises = await Effect.runPromise(
 *   getExercisesContent({
 *     locale: "en",
 *     filePath: "exercises/high-school/tka/mathematics/try-out/set-1",
 *     includeMDX: true
 *   })
 * );
 * ```
 */
export function getExercisesContent(
  options: ExerciseContentOptions
): Effect.Effect<Exercise[], ExerciseLoadError | ChoicesValidationError> {
  return Effect.gen(function* () {
    const { includeMDX = true, locale, filePath } = options;
    const cleanPath = cleanSlug(filePath);

    const allSlugs = getMDXSlugsForLocale(locale);

    const exercisePathPrefix = cleanPath === "" ? "" : `${cleanPath}/`;
    const questionNumbers = new Set<string>();

    for (const slug of allSlugs) {
      if (!slug.startsWith(exercisePathPrefix)) {
        continue;
      }

      const remainingPath = slug.slice(exercisePathPrefix.length);
      const pathParts = remainingPath.split("/");

      if (pathParts.length >= 1 && NUMBER_REGEX.test(pathParts[0])) {
        questionNumbers.add(pathParts[0]);
      }
    }

    if (questionNumbers.size === 0) {
      return [];
    }

    const sortedQuestionNumbers = Array.from(questionNumbers).sort(
      (a: string, b: string) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
    );

    const exercises = yield* Effect.all(
      sortedQuestionNumbers.map((numberStr: string) =>
        loadExercise(numberStr, cleanPath, locale, includeMDX)
      )
    );

    return exercises
      .filter(Option.isSome)
      .map((option) => option.value)
      .sort((a: Exercise, b: Exercise) => a.number - b.number);
  });
}

function loadExercise(
  numberStr: string,
  cleanPath: string,
  locale: Locale,
  includeMDX: boolean
): Effect.Effect<
  Option.Option<Exercise>,
  ExerciseLoadError | ChoicesValidationError
> {
  return Effect.gen(function* () {
    const number = Number.parseInt(numberStr, 10);
    if (Number.isNaN(number)) {
      return Option.none();
    }

    const questionPath = `${cleanPath}/${numberStr}/_question`;
    const answerPath = `${cleanPath}/${numberStr}/_answer`;

    const [questionContent, answerContent, choicesModule] = yield* Effect.all(
      [
        Effect.mapError(
          getContent(locale, questionPath, { includeMDX }),
          () =>
            new ExerciseLoadError({
              path: questionPath,
              reason: "Failed to load question",
            })
        ),
        Effect.mapError(
          getContent(locale, answerPath, { includeMDX }),
          () =>
            new ExerciseLoadError({
              path: answerPath,
              reason: "Failed to load answer",
            })
        ),
        Effect.tryPromise({
          try: () =>
            import(`@repo/contents/${cleanPath}/${numberStr}/choices.ts`),
          catch: () =>
            new ExerciseLoadError({
              path: `${cleanPath}/${numberStr}/choices.ts`,
              reason: "Failed to load choices",
            }),
        }),
      ],
      { concurrency: "unbounded" }
    );

    if (!(questionContent && answerContent && choicesModule?.default)) {
      return Option.none();
    }

    const parsedChoices = ExercisesChoicesSchema.safeParse(
      choicesModule.default
    );
    if (!parsedChoices.success) {
      return Option.none();
    }

    return Option.some({
      number,
      choices: parsedChoices.data,
      question: {
        metadata: questionContent.metadata,
        default: questionContent.default,
        raw: questionContent.raw,
      },
      answer: {
        metadata: answerContent.metadata,
        default: answerContent.default,
        raw: answerContent.raw,
      },
    });
  });
}

/**
 * Retrieves a single exercise by its number from an exercise set.
 * Convenience wrapper around getExercisesContent that finds a specific exercise.
 *
 * @param locale - Target locale
 * @param filePath - Base path to exercise set
 * @param exerciseNumber - The exercise number to retrieve
 * @param includeMDX - Whether to load MDX components (default: true)
 * @returns Effect that produces Option of exercise, Option.none() if not found
 *
 * @example
 * ```ts
 * const exercise = await Effect.runPromise(
 *   getExerciseByNumber("en", "exercises/high-school/tka/mathematics/try-out/set-1", 5)
 * );
 * ```
 */
export function getExerciseByNumber(
  locale: Locale,
  filePath: string,
  exerciseNumber: number,
  includeMDX = true
): Effect.Effect<
  Option.Option<Exercise>,
  ExerciseLoadError | ChoicesValidationError
> {
  return Effect.gen(function* () {
    const exercises = yield* getExercisesContent({
      locale,
      filePath,
      includeMDX,
    });

    return Option.fromNullable(
      exercises.find((ex: Exercise) => ex.number === exerciseNumber)
    );
  });
}
