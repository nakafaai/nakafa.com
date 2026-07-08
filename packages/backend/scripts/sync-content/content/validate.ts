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
import { listLessonRows } from "@repo/contents/_types/material/registry";
import { Effect } from "effect";

const QUESTION_FILE_PREFIX = "question.";
const ANSWER_FILE_PREFIX = "answer.";
const MDX_FILE_SUFFIX = ".mdx";

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
    const expectedAnswerFiles = new Set<string>();

    log(`Validating ${questionFiles.length} try-out question files...`);
    for (const file of questionFiles) {
      const validated = yield* Effect.either(
        Effect.gen(function* () {
          yield* readMdxFile(file);
          const answerFile = yield* readAnswerFile(file);

          expectedAnswerFiles.add(answerFile);
          yield* readMdxFile(answerFile);

          const choices = yield* readQuestionChoices(path.dirname(file));

          if (!choices || choices.en.length === 0 || choices.id.length === 0) {
            return yield* Effect.fail(
              new ScriptFailureError({
                message: `Missing try-out choices for ${file}. Add non-empty en and id choices.ts arrays.`,
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
