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
import { Effect, Option, Schema } from "effect";
import ky from "ky";

const contentsDir = resolveContentsDir(import.meta.url);
const CHOICES_DECLARATION_REGEX =
  /const\s+choices\s*(?::\s*ExercisesChoices\s*)?=/;
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
 * Finds the start index of the `choices` object literal inside a choices file.
 *
 * @param source - Raw `choices.ts` source text
 * @returns Object-literal start index, or `null` when no choices declaration exists
 */
function getChoicesObjectStart(source: string) {
  const declaration = source.match(CHOICES_DECLARATION_REGEX);

  if (!declaration || declaration.index === undefined) {
    return null;
  }

  const declarationEnd = declaration.index + declaration[0].length;
  const objectStart = source.indexOf("{", declarationEnd);

  return objectStart === -1 ? null : objectStart;
}

/**
 * Skips a quoted JavaScript string while preserving escaped delimiters.
 *
 * @param source - Raw JavaScript source text
 * @param startIndex - Index of the opening quote
 * @returns Index of the closing quote, or the last source index when unterminated
 */
function skipQuotedString(source: string, startIndex: number) {
  const quote = source[startIndex];

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const char = source[index];

    if (char === "\\") {
      index += 1;
      continue;
    }

    if (char === quote) {
      return index;
    }
  }

  return source.length - 1;
}

/**
 * Extracts the complete `choices` object literal without being confused by
 * math labels that contain braces or semicolons inside strings.
 *
 * @param source - Raw `choices.ts` source text
 * @returns Complete object-literal source, or `null` when it is incomplete
 */
function extractChoicesObjectLiteral(source: string) {
  const objectStart = getChoicesObjectStart(source);

  if (objectStart === null) {
    return null;
  }

  let depth = 0;

  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index];

    if (char === '"' || char === "'" || char === "`") {
      index = skipQuotedString(source, index);
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char !== "}") {
      continue;
    }

    depth -= 1;

    if (depth === 0) {
      return source.slice(objectStart, index + 1);
    }
  }

  return null;
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
          message: "Path traversal detected while resolving exercise source.",
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
          cause,
          message: "Unable to read exercise source file.",
          path: fullPath,
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
    catch: (cause) =>
      new GitHubFetchError({
        cause,
        message: "Unable to fetch exercise source from GitHub fallback.",
        url,
      }),
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
    const choicesLiteral = extractChoicesObjectLiteral(raw);

    if (choicesLiteral === null) {
      return null;
    }

    const choicesObject = yield* Effect.option(
      Effect.try({
        try: () => new Function(`return ${choicesLiteral}`)(),
        catch: () => null,
      })
    );

    if (Option.isNone(choicesObject)) {
      return null;
    }

    const parsed = Schema.decodeUnknownOption(ExercisesChoicesSchema)(
      choicesObject.value
    );
    return Option.isSome(parsed) ? parsed.value : null;
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
