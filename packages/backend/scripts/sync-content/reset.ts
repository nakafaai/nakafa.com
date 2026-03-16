import { runConvexMutationGeneric } from "./convexApi";
import { getContentCounts } from "./counts";
import { formatDuration, log, logSuccess, logWarning } from "./logging";
import { clearSyncState } from "./runtime";
import { BatchDeleteResultSchema } from "./schemas";
import type { ConvexConfig, SyncOptions } from "./types";

interface ResetStep {
  label: string;
  mutationPath: string;
  resultLabel: string;
}

const RESET_STEPS: ResetStep[] = [
  {
    label: "Deleting content authors...",
    mutationPath: "contentSync/mutations:deleteContentAuthorsBatch",
    resultLabel: "content authors",
  },
  {
    label: "Deleting article references...",
    mutationPath: "contentSync/mutations:deleteArticleReferencesBatch",
    resultLabel: "article references",
  },
  {
    label: "Deleting exercise choices...",
    mutationPath: "contentSync/mutations:deleteExerciseChoicesBatch",
    resultLabel: "exercise choices",
  },
  {
    label: "Deleting exercise answers...",
    mutationPath: "contentSync/mutations:deleteExerciseAnswersBatch",
    resultLabel: "exercise answers",
  },
  {
    label: "Deleting tryout part attempts...",
    mutationPath: "contentSync/mutations:deleteTryoutPartAttemptsBatch",
    resultLabel: "tryout part attempts",
  },
  {
    label: "Deleting tryout leaderboard entries...",
    mutationPath: "contentSync/mutations:deleteTryoutLeaderboardEntriesBatch",
    resultLabel: "tryout leaderboard entries",
  },
  {
    label: "Deleting user tryout stats...",
    mutationPath: "contentSync/mutations:deleteUserTryoutStatsBatch",
    resultLabel: "user tryout stats",
  },
  {
    label: "Deleting IRT scale publication queue...",
    mutationPath: "contentSync/mutations:deleteIrtScalePublicationQueueBatch",
    resultLabel: "IRT scale publication queue entries",
  },
  {
    label: "Deleting IRT scale version items...",
    mutationPath: "contentSync/mutations:deleteIrtScaleVersionItemsBatch",
    resultLabel: "IRT scale version items",
  },
  {
    label: "Deleting exercise item parameters...",
    mutationPath: "contentSync/mutations:deleteExerciseItemParametersBatch",
    resultLabel: "exercise item parameters",
  },
  {
    label: "Deleting IRT calibration queue...",
    mutationPath: "contentSync/mutations:deleteIrtCalibrationQueueBatch",
    resultLabel: "IRT calibration queue entries",
  },
  {
    label: "Deleting exercise attempts...",
    mutationPath: "contentSync/mutations:deleteExerciseAttemptsBatch",
    resultLabel: "exercise attempts",
  },
  {
    label: "Deleting tryout attempts...",
    mutationPath: "contentSync/mutations:deleteTryoutAttemptsBatch",
    resultLabel: "tryout attempts",
  },
  {
    label: "Deleting tryout part sets...",
    mutationPath: "contentSync/mutations:deleteTryoutPartSetsBatch",
    resultLabel: "tryout part sets",
  },
  {
    label: "Deleting IRT scale versions...",
    mutationPath: "contentSync/mutations:deleteIrtScaleVersionsBatch",
    resultLabel: "IRT scale versions",
  },
  {
    label: "Deleting IRT calibration runs...",
    mutationPath: "contentSync/mutations:deleteIrtCalibrationRunsBatch",
    resultLabel: "IRT calibration runs",
  },
  {
    label: "Deleting tryouts...",
    mutationPath: "contentSync/mutations:deleteTryoutsBatch",
    resultLabel: "tryouts",
  },
  {
    label: "Deleting exercise questions...",
    mutationPath: "contentSync/mutations:deleteExerciseQuestionsBatch",
    resultLabel: "exercise questions",
  },
  {
    label: "Deleting subject sections...",
    mutationPath: "contentSync/mutations:deleteSubjectSectionsBatch",
    resultLabel: "subject sections",
  },
  {
    label: "Deleting exercise sets...",
    mutationPath: "contentSync/mutations:deleteExerciseSetsBatch",
    resultLabel: "exercise sets",
  },
  {
    label: "Deleting subject topics...",
    mutationPath: "contentSync/mutations:deleteSubjectTopicsBatch",
    resultLabel: "subject topics",
  },
  {
    label: "Deleting articles...",
    mutationPath: "contentSync/mutations:deleteArticlesBatch",
    resultLabel: "articles",
  },
];

const deleteAllBatched = async (
  config: ConvexConfig,
  mutationPath: string,
  label: string
): Promise<number> => {
  let totalDeleted = 0;
  let batchNum = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await runConvexMutationGeneric(
      config,
      mutationPath,
      {},
      BatchDeleteResultSchema
    );
    totalDeleted += result.deleted;
    hasMore = result.hasMore;

    if (result.deleted > 0) {
      process.stdout.write(
        `\r  Batch ${batchNum}: deleted ${totalDeleted} ${label}...`
      );
      batchNum++;
    }
  }

  if (totalDeleted > 0) {
    process.stdout.write("\n");
  }
  return totalDeleted;
};

export const reset = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> => {
  log("=== RESET CONTENT ===\n");
  log(
    "This will DELETE synced content and the runtime data derived from it.\n"
  );

  if (options.prod) {
    logWarning("PRODUCTION DATABASE SELECTED!");
    logWarning("This will permanently delete all content from production.\n");
  }
  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  log("Current database contents:\n");
  const counts = await getContentCounts(config);

  log(`  Content Authors:       ${counts.contentAuthors}`);
  log(`  Article References:    ${counts.articleReferences}`);
  log(`  Exercise Choices:      ${counts.exerciseChoices}`);
  log(`  Exercise Answers:      ${counts.exerciseAnswers}`);
  log(`  Exercise Questions:    ${counts.exerciseQuestions}`);
  log(`  Exercise Attempts:     ${counts.exerciseAttempts}`);
  log(`  Exercise Sets:         ${counts.exerciseSets}`);
  log(`  Tryouts:               ${counts.tryouts}`);
  log(`  Tryout Part Sets:      ${counts.tryoutPartSets}`);
  log(`  Tryout Attempts:       ${counts.tryoutAttempts}`);
  log(`  Tryout Part Attempts:  ${counts.tryoutPartAttempts}`);
  log(`  Tryout Leaderboard:    ${counts.tryoutLeaderboardEntries}`);
  log(`  User Tryout Stats:     ${counts.userTryoutStats}`);
  log(`  IRT Calibration Queue: ${counts.irtCalibrationQueue}`);
  log(`  IRT Calibration Runs:  ${counts.irtCalibrationRuns}`);
  log(`  IRT Item Params:       ${counts.exerciseItemParameters}`);
  log(`  IRT Scale Queue:       ${counts.irtScalePublicationQueue}`);
  log(`  IRT Scale Versions:    ${counts.irtScaleVersions}`);
  log(`  IRT Scale Items:       ${counts.irtScaleVersionItems}`);
  log(`  Subject Sections:      ${counts.subjectSections}`);
  log(`  Subject Topics:        ${counts.subjectTopics}`);
  log(`  Articles:              ${counts.articles}`);
  log(`  Authors:               ${counts.authors}`);

  const totalContent =
    counts.articles +
    counts.subjectTopics +
    counts.subjectSections +
    counts.exerciseSets +
    counts.exerciseQuestions;
  const totalRelated =
    counts.contentAuthors +
    counts.articleReferences +
    counts.exerciseChoices +
    counts.exerciseAnswers;
  const totalRuntime =
    counts.exerciseAttempts +
    counts.tryouts +
    counts.tryoutPartSets +
    counts.tryoutAttempts +
    counts.tryoutPartAttempts +
    counts.tryoutLeaderboardEntries +
    counts.userTryoutStats +
    counts.irtCalibrationQueue +
    counts.irtCalibrationRuns +
    counts.exerciseItemParameters +
    counts.irtScalePublicationQueue +
    counts.irtScaleVersions +
    counts.irtScaleVersionItems;

  log(`\n  Total content items:  ${totalContent}`);
  log(`  Total related items:  ${totalRelated}`);
  log(`  Total runtime items:  ${totalRuntime}`);

  if (totalContent === 0 && totalRelated === 0 && totalRuntime === 0) {
    logSuccess("\nDatabase is already empty. Nothing to delete.");
    return;
  }

  if (!options.force) {
    log("\nTo delete all content, run:");
    if (options.prod) {
      log("  pnpm --filter backend sync:reset --prod --force");
    } else {
      log("  pnpm --filter backend sync:reset --force");
    }
    if (!options.authors) {
      log("\nTo also delete authors, add --authors flag");
    }
    return;
  }

  log("\nDeleting content (in dependency order)...\n");
  const startTime = performance.now();
  let totalDeleted = 0;

  for (const [index, step] of RESET_STEPS.entries()) {
    log(`${index + 1}/${RESET_STEPS.length} ${step.label}`);
    const deleted = await deleteAllBatched(
      config,
      step.mutationPath,
      step.resultLabel
    );
    logSuccess(`  Deleted ${deleted} ${step.resultLabel}`);
    totalDeleted += deleted;
  }

  if (options.authors) {
    log("Deleting authors...");
    const authorsDeleted = await deleteAllBatched(
      config,
      "contentSync/mutations:deleteAuthorsBatch",
      "authors"
    );
    logSuccess(`  Deleted ${authorsDeleted} authors`);
    totalDeleted += authorsDeleted;
  } else {
    log("Skipping authors (use --authors to include)");
  }

  log("\n=== RESET COMPLETE ===\n");
  logSuccess(
    `Deleted ${totalDeleted} items in ${formatDuration(performance.now() - startTime)}`
  );
  clearSyncState(options.prod ?? false);
  log("Cleared sync state file");

  log("\nTo re-sync content, run:");
  if (options.prod) {
    log("  pnpm --filter backend sync:prod");
  } else {
    log("  pnpm --filter backend sync");
  }
};
