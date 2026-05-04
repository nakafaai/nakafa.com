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

const createValidationResult = (): ValidationResult => ({
  valid: 0,
  invalid: 0,
  errors: [],
});

const validateArticles = async (): Promise<ValidationResult> => {
  const files = await globFiles("articles/**/*.mdx");
  const result = createValidationResult();

  log(`Validating ${files.length} article files...`);
  for (const file of files) {
    try {
      parseArticlePath(file);
      await readMdxFile(file);
      await readArticleReferences(getArticleDir(file));
      result.valid++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.invalid++;
      result.errors.push({ file, error: message });
    }
  }

  return result;
};

const validateSubjects = async (): Promise<ValidationResult> => {
  const files = await globFiles("subject/**/*.mdx");
  const materialFiles = await globFiles("subject/**/_data/*-material.ts");
  const result = createValidationResult();

  log(`Validating ${files.length} subject files...`);
  for (const file of files) {
    try {
      parseSubjectPath(file);
      await readMdxFile(file);
      result.valid++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.invalid++;
      result.errors.push({ file, error: message });
    }
  }

  log(`Validating ${materialFiles.length} material files...`);
  for (const materialFile of materialFiles) {
    try {
      const localeMatch = materialFile.match(
        LOCALE_SUBJECT_MATERIAL_FILE_REGEX
      );
      if (localeMatch) {
        await parseSubjectMaterialFile(
          materialFile,
          parseLocale(localeMatch[1], materialFile)
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.invalid++;
      result.errors.push({ file: materialFile, error: message });
    }
  }

  return result;
};

const validateExercises = async (): Promise<ValidationResult> => {
  const questionFiles = await globFiles("exercises/**/_question/*.mdx");
  const materialFiles = await globFiles("exercises/**/_data/*-material.ts");
  const result = createValidationResult();

  log(`Validating ${questionFiles.length} exercise question files...`);
  for (const file of questionFiles) {
    try {
      parseExercisePath(file);
      await readMdxFile(file);
      await readExerciseChoices(getExerciseDir(file));
      result.valid++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.invalid++;
      result.errors.push({ file, error: message });
    }
  }

  log(`Validating ${materialFiles.length} material files...`);
  for (const materialFile of materialFiles) {
    try {
      const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);
      if (localeMatch) {
        await parseExerciseMaterialFile(
          materialFile,
          parseLocale(localeMatch[1], materialFile)
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.invalid++;
      result.errors.push({ file: materialFile, error: message });
    }
  }

  return result;
};

export const validate = async (): Promise<void> => {
  log("=== VALIDATE CONTENT ===\n");
  log("Validating all content files without syncing...\n");

  const startTime = performance.now();
  const articleResult = await validateArticles();
  const subjectResult = await validateSubjects();
  const exerciseResult = await validateExercises();

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
  process.exit(1);
};
