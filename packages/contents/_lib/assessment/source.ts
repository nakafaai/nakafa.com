import nodePath from "node:path";
import { getExerciseQuestionNumber } from "@repo/contents/_lib/assessment/collection";
import { ContentIO } from "@repo/contents/_lib/io/content";
import {
  extractObjectLiteralAfterDeclaration,
  parseObjectLiteral,
} from "@repo/contents/_lib/literal";
import { extractMetadata } from "@repo/contents/_lib/metadata";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import {
  FileReadError,
  GitHubFetchError,
  InvalidPathError,
} from "@repo/contents/_shared/error";
import { ExercisesChoicesSchema } from "@repo/contents/_types/assessment/choices";
import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option, Schema } from "effect";

const contentsDir = resolveContentsDir(import.meta.url);
const CHOICES_DECLARATION_REGEX =
  /const\s+choices\s*(?::\s*ExercisesChoices\s*)?=/;
const MATERIAL_ROOT = "material";

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
 * Resolves a content-relative practice path under the material root.
 *
 * @param filePath - Relative path inside `packages/contents`
 * @returns Absolute file path, or `Option.none()` for unsafe/non-material paths
 */
function resolveExerciseFilePath(filePath: string) {
  if (nodePath.isAbsolute(filePath)) {
    return Option.none();
  }

  const cleanPath = cleanSlug(filePath);
  const segments = cleanPath.split("/");

  if (segments[0] !== MATERIAL_ROOT) {
    return Option.none();
  }

  if (!segments.every(isSafePathSegment)) {
    return Option.none();
  }

  return Option.some(
    nodePath
      .join(contentsDir, MATERIAL_ROOT, ...segments.slice(1))
      .replaceAll(nodePath.sep, "/")
  );
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
    questionPath: `${cleanPath}/${exerciseNumberSegment}/question`,
    answerPath: `${cleanPath}/${exerciseNumberSegment}/answer`,
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
    loadAnswer: (
      filePath: string
    ) => Effect.Effect<Option.Option<TAnswer>, TError>;
    loadChoices: (
      filePath: string
    ) => Effect.Effect<Option.Option<TChoices>, TError>;
    loadQuestion: (
      filePath: string
    ) => Effect.Effect<Option.Option<TQuestion>, TError>;
  }
) {
  return Effect.gen(function* () {
    const exerciseNumber = getExerciseQuestionNumber(exerciseNumberSegment);

    if (exerciseNumber === null) {
      return Option.none();
    }

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

    if (
      Option.isNone(question) ||
      Option.isNone(answer) ||
      Option.isNone(choices)
    ) {
      return Option.none();
    }

    return Option.some({
      answer: answer.value,
      choices: choices.value,
      number: exerciseNumber,
      question: question.value,
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

    if (Option.isNone(fullPath)) {
      return yield* Effect.fail(
        new InvalidPathError({
          message: "Path traversal detected while resolving exercise source.",
          path: filePath,
          reason: "Path traversal detected",
        })
      );
    }

    return yield* ContentIO.readFileString(fullPath.value).pipe(
      Effect.provide(ContentIO.Default),
      Effect.mapError(
        (cause) =>
          new FileReadError({
            cause,
            message: "Unable to read exercise source file.",
            path: fullPath.value,
          })
      )
    );
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
  const fetchFromGitHub = ContentIO.fetchText(url).pipe(
    Effect.provide(ContentIO.Default),
    Effect.mapError(
      (cause) =>
        new GitHubFetchError({
          cause,
          message: "Unable to fetch exercise source from GitHub fallback.",
          url,
        })
    )
  );

  return readContentsText(filePath).pipe(
    Effect.catchTag("FileReadError", () => fetchFromGitHub)
  );
}

/**
 * Reads and parses one `choices.ts` file for an exercise.
 *
 * Read failures reject so callers can decide whether missing source is fatal or
 * should be treated as an incomplete exercise. Invalid or missing `choices`
 * exports return `Option.none()` because the file exists but its payload is
 * unusable.
 *
 * @param choicesPath - Root-relative path to the `choices.ts` file
 * @returns Parsed choices payload, or `Option.none()` when the file is invalid
 */
export function readExerciseChoices(choicesPath: string) {
  return Effect.gen(function* () {
    const raw = yield* readContentsTextWithGitHubFallback(choicesPath);
    const choicesLiteral = extractObjectLiteralAfterDeclaration(
      raw,
      CHOICES_DECLARATION_REGEX
    );

    if (Option.isNone(choicesLiteral)) {
      return Option.none();
    }

    const choicesObject = parseObjectLiteral(choicesLiteral.value);
    if (Option.isNone(choicesObject)) {
      return Option.none();
    }

    return Schema.decodeUnknownOption(ExercisesChoicesSchema)(
      choicesObject.value
    );
  });
}

/**
 * Reads one exercise MDX file as raw text and parses its metadata without
 * importing the compiled MDX module.
 *
 * @param locale - Locale used to resolve the localized MDX file
 * @param filePath - Exercise question or answer path relative to `packages/contents`
 * @returns Metadata plus raw MDX, or `Option.none()` when the file is missing or invalid
 */
export function readExerciseContentData(locale: Locale, filePath: string) {
  const cleanPath = cleanSlug(filePath);

  return Effect.gen(function* () {
    const raw = yield* readContentsText(`${cleanPath}.${locale}.mdx`).pipe(
      Effect.map(Option.some),
      Effect.catchTags({
        FileReadError: () => Effect.succeed(Option.none()),
        InvalidPathError: () => Effect.succeed(Option.none()),
      })
    );

    if (Option.isNone(raw)) {
      return Option.none();
    }

    const metadata = extractMetadata(raw.value);

    if (Option.isNone(metadata)) {
      return Option.none();
    }

    return Option.some({
      metadata: metadata.value,
      raw: raw.value,
    });
  });
}
