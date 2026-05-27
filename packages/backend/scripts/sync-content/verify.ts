import {
  getUnknownMessage,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import { getContentCounts } from "@repo/backend/scripts/sync-content/counts";
import { getDataIntegrity } from "@repo/backend/scripts/sync-content/inspection";
import {
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/logging";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";

const logIntegrityList = (
  title: string,
  items: readonly string[],
  successMessage: string
): boolean => {
  if (items.length === 0) {
    logSuccess(successMessage);
    return false;
  }

  logError(`${items.length} ${title}:`);
  for (const item of items.slice(0, 5)) {
    log(`  - ${item}`);
  }
  if (items.length > 5) {
    log(`  ... and ${items.length - 5} more`);
  }
  return true;
};

/** Verifies filesystem content counts against Convex read models. */
export const verify = Effect.fn("sync.verify")(function* (
  config: ConvexConfig,
  options: SyncOptions = {}
) {
  log("=== VERIFY CONTENT ===\n");

  const [
    articleFiles,
    subjectFiles,
    subjectMaterialFiles,
    exerciseMaterialFiles,
    questionFiles,
    answerFiles,
    choicesFiles,
    refFiles,
  ] = yield* Effect.all([
    globFiles("articles/**/*.mdx"),
    globFiles("subject/**/*.mdx"),
    globFiles("subject/**/_data/*-material.ts"),
    globFiles("exercises/**/_data/*-material.ts"),
    globFiles("exercises/**/_question/*.mdx"),
    globFiles("exercises/**/_answer/*.mdx"),
    globFiles("exercises/**/choices.ts"),
    globFiles("articles/**/ref.ts"),
  ]);

  const articleLocaleCounts = locales.map((locale) => ({
    count: articleFiles.filter((file) => file.endsWith(`/${locale}.mdx`))
      .length,
    locale,
  }));
  const subjectLocaleCounts = locales.map((locale) => ({
    count: subjectFiles.filter((file) => file.endsWith(`/${locale}.mdx`))
      .length,
    locale,
  }));
  const questionLocaleCounts = locales.map((locale) => ({
    count: questionFiles.filter((file) => file.endsWith(`/${locale}.mdx`))
      .length,
    locale,
  }));

  log("=== FILESYSTEM ===\n");
  log("Articles:");
  log(`  Total MDX files:     ${articleFiles.length}`);
  for (const { count, locale } of articleLocaleCounts) {
    log(`    - ${locale}: ${count}`);
  }
  log(`  Reference files:     ${refFiles.length} (ref.ts)`);

  log("\nSubjects:");
  log(`  Material files:      ${subjectMaterialFiles.length} (*-material.ts)`);
  log(`  Total MDX files:     ${subjectFiles.length}`);
  for (const { count, locale } of subjectLocaleCounts) {
    log(`    - ${locale}: ${count}`);
  }

  log("\nExercises:");
  log(`  Material files:      ${exerciseMaterialFiles.length} (*-material.ts)`);
  log(`  Question files:      ${questionFiles.length} (_question/*.mdx)`);
  for (const { count, locale } of questionLocaleCounts) {
    log(`    - ${locale}: ${count}`);
  }
  log(`  Answer files:        ${answerFiles.length} (_answer/*.mdx)`);
  log(`  Choices files:       ${choicesFiles.length} (choices.ts)`);

  log("\n=== DATABASE ===\n");

  const countsResult = yield* Effect.either(getContentCounts(config));
  if (countsResult._tag === "Left") {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Failed to query database: ${getUnknownMessage(countsResult.left)}`,
      })
    );
  }

  const counts = countsResult.right;

  log("Content tables:");
  log(`  articleContents:     ${counts.articles}`);
  log(`  subjectTopics:       ${counts.subjectTopics}`);
  log(`  subjectSections:     ${counts.subjectSections}`);
  log(`  exerciseSets:        ${counts.exerciseSets}`);
  log(`  exerciseQuestions:   ${counts.exerciseQuestions}`);
  log(`  contentSearch: ${counts.contentSearch}`);
  log(`  tryouts:             ${counts.tryouts}`);

  log("\nRelated tables:");
  log(`  authors:             ${counts.authors}`);
  log(`  contentAuthors:      ${counts.contentAuthors} (content-author links)`);
  log(`  articleReferences:   ${counts.articleReferences}`);
  log(`  exerciseChoices:     ${counts.exerciseChoices}`);

  log("\n=== VERIFICATION ===\n");

  let allMatch = true;
  let hasWarnings = false;

  if (counts.articles === articleFiles.length) {
    logSuccess(
      `Articles: ${counts.articles} in DB = ${articleFiles.length} files`
    );
  } else {
    logError(
      `Articles: ${counts.articles} in DB != ${articleFiles.length} files`
    );
    allMatch = false;
  }

  if (counts.subjectSections === subjectFiles.length) {
    logSuccess(
      `Subject Sections: ${counts.subjectSections} in DB = ${subjectFiles.length} files`
    );
  } else {
    logError(
      `Subject Sections: ${counts.subjectSections} in DB != ${subjectFiles.length} files`
    );
    allMatch = false;
  }

  if (counts.exerciseQuestions === questionFiles.length) {
    logSuccess(
      `Questions: ${counts.exerciseQuestions} in DB = ${questionFiles.length} question files`
    );
  } else {
    logError(
      `Questions: ${counts.exerciseQuestions} in DB != ${questionFiles.length} question files`
    );
    allMatch = false;
  }

  log(
    `\nReferences: ${counts.articleReferences} in DB (from ${refFiles.length} ref.ts files x ${locales.length} locales)`
  );

  const avgChoicesPerQuestion =
    counts.exerciseQuestions > 0
      ? counts.exerciseChoices / counts.exerciseQuestions
      : 0;
  log(
    `Choices: ${counts.exerciseChoices} in DB (~${avgChoicesPerQuestion.toFixed(1)} per question)`
  );
  log(`Content-Author links: ${counts.contentAuthors} in DB`);

  if (answerFiles.length !== questionFiles.length) {
    log(
      `\nWARNING: Answer files (${answerFiles.length}) != Question files (${questionFiles.length})`
    );
    hasWarnings = true;
  }

  log("\n=== DATA INTEGRITY ===\n");
  const integrityResult = yield* Effect.either(getDataIntegrity(config));
  if (integrityResult._tag === "Left") {
    return yield* Effect.fail(
      new ScriptFailureError({
        message: `Failed to query database: ${getUnknownMessage(integrityResult.left)}`,
      })
    );
  }

  const integrity = integrityResult.right;

  allMatch =
    !logIntegrityList(
      "questions without choices",
      integrity.questionsWithoutChoices,
      `All ${integrity.totalQuestions} questions have choices`
    ) && allMatch;
  allMatch =
    !logIntegrityList(
      "questions without authors",
      integrity.questionsWithoutAuthors,
      `All ${integrity.totalQuestions} questions have authors`
    ) && allMatch;
  allMatch =
    !logIntegrityList(
      "sections without topics",
      integrity.sectionsWithoutTopics,
      `All ${integrity.totalSections} sections have topics`
    ) && allMatch;
  allMatch =
    !logIntegrityList(
      "active tryouts without published scales",
      integrity.activeTryoutsWithoutScale,
      `All ${counts.tryouts} active tryouts have published scales`
    ) && allMatch;

  const articlesWithRefs =
    integrity.totalArticles - integrity.articlesWithoutReferences.length;
  log(
    `Articles with references: ${articlesWithRefs}/${integrity.totalArticles}`
  );

  log("\n=== SUMMARY ===\n");
  if (allMatch) {
    logSuccess("All primary content synced correctly!");
    log(`  - ${counts.articles} articles`);
    log(`  - ${counts.subjectTopics} subject topics`);
    log(`  - ${counts.subjectSections} subject sections`);
    log(`  - ${counts.exerciseSets} exercise sets`);
    log(`  - ${counts.exerciseQuestions} exercise questions`);
    log(`  - ${counts.contentSearch} content search rows`);
    log(`  - ${counts.tryouts} tryouts`);
    log(`  - ${counts.articleReferences} references`);
    log(`  - ${counts.exerciseChoices} choices`);
    log(`  - ${counts.authors} authors`);

    if (hasWarnings) {
      log("\nSome warnings found (see above)");
    }
    return;
  }

  logError("Content mismatch detected!");
  if (options.prod) {
    log("\nRun 'pnpm --filter @repo/backend sync:prod' to fix");
  } else {
    log("\nRun 'pnpm --filter @repo/backend sync' to fix");
  }
  return yield* Effect.fail(
    new ScriptFailureError({ message: "Content verification failed." })
  );
});
