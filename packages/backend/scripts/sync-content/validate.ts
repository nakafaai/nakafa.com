import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import {
  readArticleReferences,
  readExerciseChoices,
  readMdxFile,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import {
  parseExerciseMaterialFile,
  parseSubjectMaterialFile,
} from "@repo/backend/scripts/lib/mdx-parser/materials";
import {
  getArticleDir,
  getExerciseDir,
  parseArticlePath,
  parseExercisePath,
  parseSubjectPath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import {
  formatDuration,
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/logging";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime";
import {
  LOCALE_MATERIAL_FILE_REGEX,
  LOCALE_SUBJECT_MATERIAL_FILE_REGEX,
  parseLocale,
} from "@repo/backend/scripts/sync-content/schemas";
import type { ValidationResult } from "@repo/backend/scripts/sync-content/types";
import { Effect } from "effect";

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
  const files = yield* globFiles("subject/**/*.mdx");
  const materialFiles = yield* globFiles("subject/**/_data/*-material.ts");
  const result = createValidationResult();

  log(`Validating ${files.length} subject files...`);
  for (const file of files) {
    const validated = yield* Effect.either(
      Effect.gen(function* () {
        yield* parseSubjectPath(file);
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

  log(`Validating ${materialFiles.length} material files...`);
  for (const materialFile of materialFiles) {
    const validated = yield* Effect.either(
      Effect.gen(function* () {
        const localeMatch = materialFile.match(
          LOCALE_SUBJECT_MATERIAL_FILE_REGEX
        );
        if (localeMatch) {
          const locale = yield* parseLocale(localeMatch[1], materialFile);
          yield* parseSubjectMaterialFile(materialFile, locale);
        }
      })
    );

    if (validated._tag === "Left") {
      const message =
        validated.left instanceof Error
          ? validated.left.message
          : String(validated.left);
      result.invalid++;
      result.errors.push({ file: materialFile, error: message });
    }
  }

  return result;
});

const validateExercises = Effect.fn("sync.validateExercises")(function* () {
  const questionFiles = yield* globFiles("exercises/**/_question/*.mdx");
  const materialFiles = yield* globFiles("exercises/**/_data/*-material.ts");
  const result = createValidationResult();

  log(`Validating ${questionFiles.length} exercise question files...`);
  for (const file of questionFiles) {
    const validated = yield* Effect.either(
      Effect.gen(function* () {
        yield* parseExercisePath(file);
        yield* readMdxFile(file);
        const exerciseDir = yield* getExerciseDir(file);
        yield* readExerciseChoices(exerciseDir);
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

  log(`Validating ${materialFiles.length} material files...`);
  for (const materialFile of materialFiles) {
    const validated = yield* Effect.either(
      Effect.gen(function* () {
        const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);
        if (localeMatch) {
          const locale = yield* parseLocale(localeMatch[1], materialFile);
          yield* parseExerciseMaterialFile(materialFile, locale);
        }
      })
    );

    if (validated._tag === "Left") {
      const message =
        validated.left instanceof Error
          ? validated.left.message
          : String(validated.left);
      result.invalid++;
      result.errors.push({ file: materialFile, error: message });
    }
  }

  return result;
});

/** Validates content files without writing to Convex. */
export const validate = Effect.fn("sync.validate")(function* () {
  log("=== VALIDATE CONTENT ===\n");
  log("Validating all content files without syncing...\n");

  const startTime = performance.now();
  const articleResult = yield* validateArticles();
  const subjectResult = yield* validateSubjects();
  const exerciseResult = yield* validateExercises();

  const totalValid =
    articleResult.valid + subjectResult.valid + exerciseResult.valid;
  const totalInvalid =
    articleResult.invalid + subjectResult.invalid + exerciseResult.invalid;
  const allErrors = [
    ...articleResult.errors,
    ...subjectResult.errors,
    ...exerciseResult.errors,
  ];

  log("\n=== VALIDATION SUMMARY ===\n");
  log(
    `Articles:  ${articleResult.valid} valid, ${articleResult.invalid} invalid`
  );
  log(
    `Subjects:  ${subjectResult.valid} valid, ${subjectResult.invalid} invalid`
  );
  log(
    `Exercises: ${exerciseResult.valid} valid, ${exerciseResult.invalid} invalid`
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
