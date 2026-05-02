import { promises as fsPromises } from "node:fs";
import nodePath from "node:path";
import { extractMetadata } from "@repo/contents/_lib/metadata";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import {
  FileReadError,
  GitHubFetchError,
  InvalidPathError,
} from "@repo/contents/_shared/error";
import type { Locale } from "@repo/contents/_types/content";
import { ExercisesChoicesSchema } from "@repo/contents/_types/exercises/choices";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Either, Option } from "effect";
import ky from "ky";

const contentsDir = resolveContentsDir(import.meta.url);
const CHOICES_REGEX =
  /const\s+choices\s*(?::\s*ExercisesChoices\s*)?=\s*({[\s\S]*?});/;
const EXERCISES_ROOT = "exercises";

/**
 * Checks whether a clean path segment is safe for filesystem lookup.
 *
 * @param segment - One slash-delimited path segment
 * @returns True when the segment cannot traverse outside the exercise root
 */
function isSafePathSegment(segment: string) {
  return segment !== "" && segment !== "." && segment !== "..";
}

/**
 * Resolves a content-relative exercise path under the literal exercises root.
 *
 * @param filePath - Relative path inside `packages/contents`
 * @returns Absolute file path, or `null` for unsafe/non-exercise paths
 */
function resolveExerciseFilePath(filePath: string) {
  if (nodePath.isAbsolute(filePath)) {
    return null;
  }

  const cleanPath = cleanSlug(filePath);
  const segments = cleanPath.split("/");

  if (segments[0] !== EXERCISES_ROOT) {
    return null;
  }

  if (!segments.every(isSafePathSegment)) {
    return null;
  }

  return nodePath
    .join(contentsDir, EXERCISES_ROOT, ...segments.slice(1))
    .replaceAll(nodePath.sep, "/");
}

/**
 * Builds the content and choices file paths for one exercise inside a set.
 *
 * @param cleanPath - Normalized exercise-set path relative to `packages/contents`
 * @param exerciseNumberSegment - Numbered exercise directory inside the set
 * @returns Root-relative question, answer, and choices paths for the exercise
 */
function getExerciseEntryPaths(
  cleanPath: string,
  exerciseNumberSegment: string
) {
  return {
    questionPath: `${cleanPath}/${exerciseNumberSegment}/_question`,
    answerPath: `${cleanPath}/${exerciseNumberSegment}/_answer`,
    choicesPath: `${cleanPath}/${exerciseNumberSegment}/choices.ts`,
  };
}

/**
 * Loads one exercise entry by composing question, answer, and choices loaders
 * for the numbered folder inside an exercise set.
 */
export function loadExerciseEntry<TQuestion, TAnswer, TChoices, TError>(
  cleanPath: string,
  exerciseNumberSegment: string,
  options: {
    loadAnswer: (filePath: string) => Effect.Effect<TAnswer | null, TError>;
    loadChoices: (filePath: string) => Effect.Effect<TChoices | null, TError>;
    loadQuestion: (filePath: string) => Effect.Effect<TQuestion | null, TError>;
  }
) {
  return Effect.gen(function* () {
    const exerciseNumber = Number.parseInt(exerciseNumberSegment, 10);
    const { answerPath, choicesPath, questionPath } = getExerciseEntryPaths(
      cleanPath,
      exerciseNumberSegment
    );

    const [question, answer, choices] = yield* Effect.all(
      [
        options.loadQuestion(questionPath),
        options.loadAnswer(answerPath),
        options.loadChoices(choicesPath),
      ],
      { concurrency: "unbounded" }
    );

    if (!(question && answer && choices)) {
      return Option.none();
    }

    return Option.some({
      answer,
      choices,
      number: exerciseNumber,
      question,
    });
  });
}

/**
 * Builds the canonical GitHub raw URL for one contents file.
 *
 * @param filePath - Relative file path inside `packages/contents`
 * @returns Raw GitHub URL for the file
 */
function getRawGitHubUrl(filePath: string) {
  return `https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/packages/contents/${filePath}`;
}

/**
 * Reads one text file from the contents workspace.
 *
 * @param filePath - Relative file path inside `packages/contents`
 * @returns Effect that resolves to the raw local file contents
 */
function readContentsText(filePath: string) {
  return Effect.gen(function* () {
    const fullPath = resolveExerciseFilePath(filePath);

    if (!fullPath) {
      return yield* Effect.fail(
        new InvalidPathError({
          path: filePath,
          reason: "Path traversal detected",
        })
      );
    }

    return yield* Effect.tryPromise({
      try: () =>
        fsPromises.readFile(/* turbopackIgnore: true */ fullPath, "utf8"),
      catch: (cause) =>
        new FileReadError({
          path: fullPath,
          cause,
        }),
    });
  });
}

/**
 * Reads one text file and falls back to the canonical GitHub raw copy.
 *
 * @param filePath - Relative file path inside `packages/contents`
 * @returns Effect that resolves to raw file contents from disk or GitHub
 */
function readContentsTextWithGitHubFallback(filePath: string) {
  const url = getRawGitHubUrl(filePath);
  const fetchFromGitHub = Effect.tryPromise({
    try: () => ky.get(url, { cache: "force-cache" }).text(),
    catch: (cause) => new GitHubFetchError({ url, cause }),
  });

  return readContentsText(filePath).pipe(
    Effect.catchTag("FileReadError", () => fetchFromGitHub)
  );
}

/**
 * Reads and parses one `choices.ts` file for an exercise.
 *
 * Read failures reject so callers can decide whether missing source is fatal or
 * should be treated as an incomplete exercise. Invalid or missing `choices`
 * exports return `null` because the file exists but its payload is unusable.
 *
 * @param choicesPath - Root-relative path to the `choices.ts` file
 * @returns Parsed choices payload, or `null` when the file is invalid
 */
export function readExerciseChoices(choicesPath: string) {
  return Effect.gen(function* () {
    const raw = yield* readContentsTextWithGitHubFallback(choicesPath);
    const match = raw.match(CHOICES_REGEX);

    if (!match?.[1]) {
      return null;
    }

    const choicesObject = Either.try({
      try: () => new Function(`return ${match[1]}`)(),
      catch: () => null,
    });

    if (Either.isLeft(choicesObject)) {
      return null;
    }

    const parsed = ExercisesChoicesSchema.safeParse(choicesObject.right);
    return parsed.success ? parsed.data : null;
  });
}

/**
 * Reads one exercise MDX file as raw text and parses its metadata without
 * importing the compiled MDX module.
 *
 * @param locale - Locale used to resolve the localized MDX file
 * @param filePath - Exercise question or answer path relative to `packages/contents`
 * @returns Metadata plus raw MDX, or `null` when the file is missing or invalid
 */
export function readExerciseContentData(locale: Locale, filePath: string) {
  const cleanPath = cleanSlug(filePath);

  return Effect.gen(function* () {
    const raw = yield* readContentsText(`${cleanPath}/${locale}.mdx`).pipe(
      Effect.catchTags({
        FileReadError: () => Effect.succeed(null),
        InvalidPathError: () => Effect.succeed(null),
      })
    );

    if (raw === null) {
      return null;
    }

    const metadata = extractMetadata(raw);

    if (Option.isNone(metadata)) {
      return null;
    }

    return {
      metadata: metadata.value,
      raw,
    };
  });
}
