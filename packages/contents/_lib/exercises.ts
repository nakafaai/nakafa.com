import { promises as fsPromises } from "node:fs";
import nodePath from "node:path";
import {
  getMDXSlugsForLocale,
  hasPathInCache,
} from "@repo/contents/_lib/cache";
import { getContent } from "@repo/contents/_lib/content";
import { getFolderChildNames } from "@repo/contents/_lib/fs";
import { getContentMetadataWithRaw } from "@repo/contents/_lib/metadata";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import {
  type ChoicesValidationError,
  ExerciseLoadError,
} from "@repo/contents/_shared/error";
import type { ContentMetadata, Locale } from "@repo/contents/_types/content";
import {
  type ExercisesChoices,
  ExercisesChoicesSchema,
} from "@repo/contents/_types/exercises/choices";
import type { Exercise } from "@repo/contents/_types/exercises/shared";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";
import ky from "ky";
import type React from "react";

const contentsDir = resolveContentsDir(import.meta.url);

const CHOICES_REGEX =
  /const\s+choices\s*(?::\s*ExercisesChoices\s*)?=\s*({[\s\S]*?});/;

const NUMBER_REGEX = /^\d+$/;
const EXERCISE_CONTENT_SEGMENTS = new Set(["_question", "_answer"]);

/**
 * Loads one exercise content fragment, either as raw metadata or full MDX.
 *
 * @param locale - Locale used to resolve the exercise content file
 * @param filePath - Exercise question or answer path relative to `packages/contents`
 * @param includeMDX - Whether to return the compiled MDX element as well
 * @returns Promise resolving to content metadata, raw source, and optional MDX
 */
async function loadExerciseContent(
  locale: Locale,
  filePath: string,
  includeMDX: boolean
): Promise<{
  default?: React.ReactElement;
  metadata: ContentMetadata;
  raw: string;
}> {
  if (!includeMDX) {
    return await Effect.runPromise(getContentMetadataWithRaw(locale, filePath));
  }

  return await Effect.runPromise(getContent(locale, filePath, { includeMDX }));
}

/**
 * Counts the number of exercises in a given path by scanning for numbered directories.
 * This is a lightweight operation that does not load any MDX content.
 * Evidence: Reuses getFolderChildNames from fs.ts for clean, maintainable code
 *
 * @param filePath - Path to the exercise set (e.g., "exercises/high-school/tka/mathematics/try-out/2026/set-1")
 * @returns Effect that produces the count of exercises, or 0 if path doesn't exist
 *
 * @example
 * ```ts
 * const count = await Effect.runPromise(
 *   getExerciseCount("exercises/high-school/tka/mathematics/try-out/2026/set-1")
 * );
 * // Returns: 40
 * ```
 */
export function getExerciseCount(filePath: string): Effect.Effect<number> {
  return Effect.gen(function* () {
    const cleanPath = cleanSlug(filePath);

    // Reuse existing getFolderChildNames - returns directory names as strings
    const childNames = yield* getFolderChildNames(cleanPath).pipe(
      Effect.orElse(() => Effect.succeed([]))
    );

    // Filter for numeric folder names (1, 2, 3, etc.)
    const exerciseCount = childNames.filter((name) =>
      NUMBER_REGEX.test(name)
    ).length;

    return exerciseCount;
  });
}

/**
 * Options for loading an exercise set from the contents package.
 */
export interface ExerciseContentOptions {
  filePath: string;
  includeMDX?: boolean;
  locale: Locale;
}

/**
 * Extracts direct exercise numbers for a specific exercise set path.
 *
 * Exercise content is stored under numbered folders such as
 * `set-1/1/_question` and `set-1/1/_answer`. This helper only accepts direct
 * number segments followed by `_question` or `_answer`, so collection routes
 * like `try-out/2026` are not misclassified as exercise pages.
 *
 * @param slugs - Cached MDX slugs for a locale
 * @param filePath - Exercise set path relative to `packages/contents`
 * @returns Sorted list of unique exercise numbers found under the set path
 */
export function getExerciseQuestionNumbers(
  slugs: readonly string[],
  filePath: string
): string[] {
  const cleanPath = cleanSlug(filePath);
  const exercisePathPrefix = cleanPath === "" ? "" : `${cleanPath}/`;
  const questionNumbers = new Set<string>();

  for (const slug of slugs) {
    if (!slug.startsWith(exercisePathPrefix)) {
      continue;
    }

    const remainingPath = slug.slice(exercisePathPrefix.length);
    const pathParts = remainingPath.split("/");

    if (
      pathParts.length >= 2 &&
      NUMBER_REGEX.test(pathParts[0]) &&
      EXERCISE_CONTENT_SEGMENTS.has(pathParts[1])
    ) {
      questionNumbers.add(pathParts[0]);
    }
  }

  return Array.from(questionNumbers).sort(
    (a: string, b: string) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
  );
}

/**
 * Retrieves all exercises for a given path, handling _question and _answer subdirectories.
 * Exercise sets are structured with numbered folders containing question/answer pairs.
 *
 * @param options - Exercise retrieval options
 * @param options.includeMDX - Whether to load MDX components (default: true)
 * @param options.locale - Target locale
 * @param options.filePath - Base path to exercise set (e.g., "exercises/high-school/tka/mathematics/try-out/2026/set-1")
 * @returns Effect that produces array of exercises sorted by number, or Option.none() if no exercises found
 *
 * @example
 * ```ts
 * const exercises = await Effect.runPromise(
 *   getExercisesContent({
 *     locale: "en",
 *     filePath: "exercises/high-school/tka/mathematics/try-out/2026/set-1",
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

    const sortedQuestionNumbers = getExerciseQuestionNumbers(
      allSlugs,
      cleanPath
    );

    if (sortedQuestionNumbers.length === 0) {
      return [];
    }

    const exercises = yield* Effect.all(
      sortedQuestionNumbers.map((numberSegment: string) =>
        loadExercise(numberSegment, cleanPath, locale, includeMDX)
      )
    );

    return exercises
      .filter(Option.isSome)
      .map((option) => option.value)
      .sort((a: Exercise, b: Exercise) => a.number - b.number);
  });
}

/**
 * Fetches and parses choices from a choices.ts file without dynamic imports.
 * Reads from filesystem first, falls back to GitHub raw content.
 */
function getRawChoices(
  choicesPath: string
): Effect.Effect<ExercisesChoices | null, ExerciseLoadError> {
  const fullPath = nodePath.join(contentsDir, choicesPath);

  const readFromFile = Effect.tryPromise({
    try: () => fsPromises.readFile(fullPath, "utf8"),
    catch: () =>
      new ExerciseLoadError({
        path: choicesPath,
        reason: "Failed to read choices file",
      }),
  });

  const fetchFromGitHub = Effect.tryPromise({
    try: () =>
      ky
        .get(
          `https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/packages/contents/${choicesPath}`,
          { cache: "force-cache" }
        )
        .text(),
    catch: () =>
      new ExerciseLoadError({
        path: choicesPath,
        reason: "Failed to fetch choices from GitHub",
      }),
  });

  const getRawContent = Effect.catchAll(readFromFile, () => fetchFromGitHub);

  return Effect.map(getRawContent, (raw) => {
    const match = raw.match(CHOICES_REGEX);
    if (!match?.[1]) {
      return null;
    }

    try {
      const choicesObject: unknown = new Function(`return ${match[1]}`)();
      const parsed = ExercisesChoicesSchema.safeParse(choicesObject);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  });
}

/**
 * Loads a single exercise entry from its numbered folder.
 *
 * @param exerciseNumberSegment - Folder name for the exercise within the set
 * @param cleanPath - Normalized exercise-set path relative to `packages/contents`
 * @param locale - Locale used to load the question and answer content
 * @param includeMDX - Whether to include compiled MDX elements in the result
 * @returns Effect that resolves to an exercise or `Option.none()` when incomplete
 */
function loadExercise(
  exerciseNumberSegment: string,
  cleanPath: string,
  locale: Locale,
  includeMDX: boolean
): Effect.Effect<
  Option.Option<Exercise>,
  ExerciseLoadError | ChoicesValidationError
> {
  return Effect.gen(function* () {
    const exerciseNumber = Number.parseInt(exerciseNumberSegment, 10);

    const questionPath = `${cleanPath}/${exerciseNumberSegment}/_question`;
    const answerPath = `${cleanPath}/${exerciseNumberSegment}/_answer`;
    const choicesPath = `${cleanPath}/${exerciseNumberSegment}/choices.ts`;

    const [questionContent, answerContent, choicesData] = yield* Effect.all(
      [
        Effect.tryPromise({
          try: () => loadExerciseContent(locale, questionPath, includeMDX),
          catch: () =>
            new ExerciseLoadError({
              path: questionPath,
              reason: "Failed to load question",
            }),
        }),
        Effect.tryPromise({
          try: () => loadExerciseContent(locale, answerPath, includeMDX),
          catch: () =>
            new ExerciseLoadError({
              path: answerPath,
              reason: "Failed to load answer",
            }),
        }),
        getRawChoices(choicesPath),
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
 *   getExerciseByNumber("en", "exercises/high-school/tka/mathematics/try-out/2026/set-1", 5)
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
    const cleanPath = cleanSlug(filePath);
    const exerciseNumberSegment = String(exerciseNumber);
    const questionPath = `${cleanPath}/${exerciseNumberSegment}/_question`;
    const answerPath = `${cleanPath}/${exerciseNumberSegment}/_answer`;

    // Mirror the old semantics: return none when the exercise number is
    // missing entirely, but still fail if a partially indexed exercise exists.
    if (
      !(
        hasPathInCache(locale, questionPath) ||
        hasPathInCache(locale, answerPath)
      )
    ) {
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
