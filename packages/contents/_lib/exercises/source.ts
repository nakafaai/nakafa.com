import { promises as fsPromises } from "node:fs";
import nodePath from "node:path";
import { extractMetadata } from "@repo/contents/_lib/metadata";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import type { Locale } from "@repo/contents/_types/content";
import { ExercisesChoicesSchema } from "@repo/contents/_types/exercises/choices";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Either, Option } from "effect";
import ky from "ky";

const contentsDir = resolveContentsDir(import.meta.url);
const CHOICES_REGEX =
  /const\s+choices\s*(?::\s*ExercisesChoices\s*)?=\s*({[\s\S]*?});/;

/**
 * Builds the content and choices file paths for one exercise inside a set.
 *
 * @param cleanPath - Normalized exercise-set path relative to `packages/contents`
 * @param exerciseNumberSegment - Numbered exercise directory inside the set
 * @returns Root-relative question, answer, and choices paths for the exercise
 */
export function getExerciseEntryPaths(
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
 * Reads one text file from the contents workspace and falls back to the
 * canonical GitHub raw copy when the local file is unavailable.
 *
 * @param filePath - Relative file path inside `packages/contents`
 * @returns Raw file contents from disk or GitHub
 */
async function readContentsTextWithGitHubFallback(filePath: string) {
  const fullPath = nodePath.join(contentsDir, filePath);

  if (!fullPath.startsWith(contentsDir)) {
    throw new Error("Path escapes contents root");
  }

  return await fsPromises
    .readFile(fullPath, "utf8")
    .catch(() =>
      ky
        .get(
          `https://raw.githubusercontent.com/nakafaai/nakafa.com/refs/heads/main/packages/contents/${filePath}`,
          { cache: "force-cache" }
        )
        .text()
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
export async function readExerciseChoices(choicesPath: string) {
  const raw = await readContentsTextWithGitHubFallback(choicesPath);
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
}

/**
 * Reads one exercise MDX file as raw text and parses its metadata without
 * importing the compiled MDX module.
 *
 * @param locale - Locale used to resolve the localized MDX file
 * @param filePath - Exercise question or answer path relative to `packages/contents`
 * @returns Metadata plus raw MDX, or `null` when the file is missing or invalid
 */
export async function readExerciseContentData(
  locale: Locale,
  filePath: string
) {
  const cleanPath = cleanSlug(filePath);
  const fullPath = nodePath.join(contentsDir, `${cleanPath}/${locale}.mdx`);

  if (!fullPath.startsWith(contentsDir)) {
    return null;
  }

  const raw = await fsPromises.readFile(fullPath, "utf8").catch(() => null);

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
}
