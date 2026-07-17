import path from "node:path";
import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import {
  readArticleReferences,
  readMdxFile,
  readQuestionChoices,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import {
  getArticleDir,
  parseArticlePath,
  parseMaterialLessonPath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import {
  formatDuration,
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { parseLocale } from "@repo/backend/scripts/sync-content/contract/schemas";
import type { ValidationResult } from "@repo/backend/scripts/sync-content/contract/types";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime/files";
import { CONTENTS_DIR } from "@repo/backend/scripts/sync-content/runtime/paths";
import { readMdxSlugManifest } from "@repo/contents/_lib/mdx-slugs/source";
import { listLessonRows } from "@repo/contents/_types/material/registry";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { defaultLocale, locales } from "@repo/utilities/locales";
import { Effect } from "effect";

const QUESTION_FILE_PREFIX = "question.";
const ANSWER_FILE_PREFIX = "answer.";
const MDX_FILE_SUFFIX = ".mdx";

/** Create an empty mutable validation accumulator for one source family. */
const createValidationResult = (): ValidationResult => ({
  valid: 0,
  invalid: 0,
  errors: [],
});

const validateArticles = Effect.fn("sync.validateArticles")(function* () {
  const files = yield* globFiles("articles/**/*.mdx");
  const result = createValidationResult();

  log(`Validating ${files.length} article files...`);
  for (const file of files) {
    const validated = yield* Effect.either(
      Effect.gen(function* () {
        yield* parseArticlePath(file);
        yield* readMdxFile(file);
        yield* readArticleReferences(getArticleDir(file));
      })
    );

    if (validated._tag === "Right") {
      result.valid++;
      continue;
    }

    const message =
      validated.left instanceof Error
        ? validated.left.message
        : String(validated.left);
    result.invalid++;
    result.errors.push({ file, error: message });
  }

  return result;
});

const validateSubjects = Effect.fn("sync.validateSubjects")(function* () {
  const files = yield* globFiles("material/lesson/**/*.mdx");
  const materialTopics = listLessonRows();
  const result = createValidationResult();

  log(`Validating ${files.length} subject files...`);
  for (const file of files) {
    const validated = yield* Effect.either(
      Effect.gen(function* () {
        yield* parseMaterialLessonPath(file);
        yield* readMdxFile(file);
      })
    );

    if (validated._tag === "Right") {
      result.valid++;
      continue;
    }

    const message =
      validated.left instanceof Error
        ? validated.left.message
        : String(validated.left);
    result.invalid++;
    result.errors.push({ file, error: message });
  }

  log(`Validating ${materialTopics.length} material lesson topics...`);
  result.valid += materialTopics.length;

  return result;
});

const validateTryoutQuestions = Effect.fn("sync.validateTryoutQuestions")(
  function* () {
    const [questionFiles, answerFiles] = yield* Effect.all([
      globFiles("question-bank/tryout/**/question.*.mdx"),
      globFiles("question-bank/tryout/**/answer.*.mdx"),
    ]);
    const result = createValidationResult();
    const expectedQuestionFiles =
      listExpectedTryoutQuestionFiles(questionFiles);
    const expectedQuestionFileSet = new Set(expectedQuestionFiles);
    const expectedAnswerFiles = new Set<string>();

    log(`Validating ${expectedQuestionFiles.length} try-out question files...`);
    for (const file of expectedQuestionFiles) {
      const validated = yield* Effect.either(
        Effect.gen(function* () {
          const answerFile = yield* readAnswerFile(file);

          expectedAnswerFiles.add(answerFile);
          yield* Effect.all([readMdxFile(file), readMdxFile(answerFile)], {
            concurrency: "unbounded",
          });

          const choices = yield* readQuestionChoices(path.dirname(file));

          if (!choices) {
            return yield* Effect.fail(
              new ScriptFailureError({
                message: `Missing or invalid try-out choices for ${file}. Add exactly one correct option for every supported locale in choices.ts.`,
              })
            );
          }
        })
      );

      if (validated._tag === "Right") {
        result.valid++;
        continue;
      }

      const message =
        validated.left instanceof Error
          ? validated.left.message
          : String(validated.left);
      result.invalid++;
      result.errors.push({ file, error: message });
    }

    for (const file of questionFiles) {
      if (expectedQuestionFileSet.has(file)) {
        continue;
      }

      result.invalid++;
      result.errors.push({
        file,
        error: "Try-out question file is not declared by the source registry.",
      });
    }

    for (const file of answerFiles) {
      if (expectedAnswerFiles.has(file)) {
        continue;
      }

      result.invalid++;
      result.errors.push({
        file,
        error: "Try-out answer file does not have a matching question file.",
      });
    }

    return result;
  }
);

function listExpectedTryoutQuestionFiles(questionFiles: readonly string[]) {
  const questionDirectories = new Set<string>();

  for (const file of questionFiles) {
    if (path.basename(file) !== `question.${defaultLocale}.mdx`) {
      continue;
    }

    questionDirectories.add(path.dirname(file));
  }

  for (const exam of TRYOUT_SOURCES) {
    for (const track of exam.tracks) {
      for (const set of track.sets) {
        for (const section of set.sections) {
          for (let number = 1; number <= section.questionCount; number++) {
            questionDirectories.add(
              path.join(
                CONTENTS_DIR,
                section.questionSourcePath,
                `question-${number}`
              )
            );
          }
        }
      }
    }
  }

  const files = new Set<string>();

  for (const questionDir of questionDirectories) {
    for (const locale of locales) {
      files.add(path.join(questionDir, `question.${locale}.mdx`));
    }
  }

  return [...files].sort();
}

/** Resolves the answer MDX file that must exist beside one question MDX file. */
const readAnswerFile = Effect.fn("sync.readAnswerFile")(function* (
  questionFile: string
) {
  const locale = yield* readLocalizedMdxLocale(
    questionFile,
    QUESTION_FILE_PREFIX
  );

  return path.join(
    path.dirname(questionFile),
    `${ANSWER_FILE_PREFIX}${locale}${MDX_FILE_SUFFIX}`
  );
});

/** Reads and validates the locale segment from a localized MDX filename. */
const readLocalizedMdxLocale = Effect.fn("sync.readLocalizedMdxLocale")(
  function* (file: string, prefix: string) {
    const basename = path.basename(file);
    const start = prefix.length;
    const end = basename.length - MDX_FILE_SUFFIX.length;

    return yield* parseLocale(basename.slice(start, end), basename);
  }
);

/** Validates content files without writing to Convex. */
export const validate = Effect.fn("sync.validate")(function* () {
  log("=== VALIDATE CONTENT ===\n");
  log("Validating all content files without syncing...\n");

  const startTime = performance.now();
  yield* readMdxSlugManifest();
  const articleResult = yield* validateArticles();
  const subjectResult = yield* validateSubjects();
  const tryoutResult = yield* validateTryoutQuestions();

  const totalValid =
    articleResult.valid + subjectResult.valid + tryoutResult.valid;
  const totalInvalid =
    articleResult.invalid + subjectResult.invalid + tryoutResult.invalid;
  const allErrors = [
    ...articleResult.errors,
    ...subjectResult.errors,
    ...tryoutResult.errors,
  ];

  log("\n=== VALIDATION SUMMARY ===\n");
  log(
    `Articles:  ${articleResult.valid} valid, ${articleResult.invalid} invalid`
  );
  log(
    `Curriculum:  ${subjectResult.valid} valid, ${subjectResult.invalid} invalid`
  );
  log(
    `Try-out:   ${tryoutResult.valid} valid, ${tryoutResult.invalid} invalid`
  );
  log("---");
  log(`Total: ${totalValid} valid, ${totalInvalid} invalid`);
  log(`Time: ${formatDuration(performance.now() - startTime)}`);

  if (allErrors.length === 0) {
    log("\n");
    logSuccess("All content files are valid!");
    return;
  }

  log("\n=== ERRORS ===\n");
  for (const error of allErrors.slice(0, 20)) {
    logError(error.file);
    log(`  ${error.error}\n`);
  }
  if (allErrors.length > 20) {
    log(`... and ${allErrors.length - 20} more errors`);
  }
  return yield* Effect.fail(
    new ScriptFailureError({ message: "Content validation failed." })
  );
});
