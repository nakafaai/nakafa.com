import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import {
  readArticleReferences,
  readMdxFile,
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
import type { ValidationResult } from "@repo/backend/scripts/sync-content/contract/types";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime/files";
import { readMdxSlugManifest } from "@repo/contents/_lib/mdx-slugs/source";
import { listLessonRows } from "@repo/contents/_types/material/registry";
import { Effect } from "effect";

/** Create an empty mutable validation accumulator for one source family. */
const createValidationResult = (): ValidationResult => ({
  errors: [],
  invalid: 0,
  valid: 0,
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
      result.valid += 1;
      continue;
    }

    result.invalid += 1;
    result.errors.push({
      error:
        validated.left instanceof Error
          ? validated.left.message
          : String(validated.left),
      file,
    });
  }

  return result;
});

const validateSubjects = Effect.fn("sync.validateSubjects")(function* () {
  const files = yield* globFiles("material/lesson/**/*.mdx");
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
      result.valid += 1;
      continue;
    }

    result.invalid += 1;
    result.errors.push({
      error:
        validated.left instanceof Error
          ? validated.left.message
          : String(validated.left),
      file,
    });
  }

  const materialTopics = listLessonRows();
  log(`Validating ${materialTopics.length} material lesson topics...`);
  result.valid += materialTopics.length;

  return result;
});

/** Validates Nakafa-owned content files without writing to Convex. */
export const validate = Effect.fn("sync.validate")(function* () {
  log("=== VALIDATE CONTENT ===\n");
  log("Validating all Nakafa-owned content files without syncing...\n");

  const startTime = performance.now();
  yield* readMdxSlugManifest();
  const articleResult = yield* validateArticles();
  const subjectResult = yield* validateSubjects();
  const totalValid = articleResult.valid + subjectResult.valid;
  const totalInvalid = articleResult.invalid + subjectResult.invalid;
  const allErrors = [...articleResult.errors, ...subjectResult.errors];

  log("\n=== VALIDATION SUMMARY ===\n");
  log(
    `Articles:  ${articleResult.valid} valid, ${articleResult.invalid} invalid`
  );
  log(
    `Curriculum:  ${subjectResult.valid} valid, ${subjectResult.invalid} invalid`
  );
  log("---");
  log(`Total: ${totalValid} valid, ${totalInvalid} invalid`);
  log(`Time: ${formatDuration(performance.now() - startTime)}`);

  if (allErrors.length === 0) {
    log("\n");
    logSuccess("All Nakafa-owned content files are valid!");
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

  return yield* new ScriptFailureError({
    message: "Content validation failed.",
  });
});
