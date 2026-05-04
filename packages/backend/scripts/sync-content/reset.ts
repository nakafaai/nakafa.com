import { runConvexMutationGeneric } from "@repo/backend/scripts/sync-content/convexApi";
import { getContentCounts } from "@repo/backend/scripts/sync-content/counts";
import {
  formatDuration,
  log,
  logSuccess,
  logWarning,
} from "@repo/backend/scripts/sync-content/logging";
import { clearSyncState } from "@repo/backend/scripts/sync-content/runtime";
import { BatchDeleteResultSchema } from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";

interface ResetStep {
  label: string;
  mutationPath: string;
  resultLabel: string;
}

const RESET_STEPS: ResetStep[] = [
  {
    label: "Deleting content authors...",
    mutationPath: "contentSync/mutations/maintenance:deleteContentAuthorsBatch",
    resultLabel: "content authors",
  },
  {
    label: "Deleting article references...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteArticleReferencesBatch",
    resultLabel: "article references",
  },
  {
    label: "Deleting exercise choices...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteExerciseChoicesBatch",
    resultLabel: "exercise choices",
  },
  {
    label: "Deleting exercise answers...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteExerciseAnswersBatch",
    resultLabel: "exercise answers",
  },
  {
    label: "Deleting tryout part attempts...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutPartAttemptsBatch",
    resultLabel: "tryout part attempts",
  },
  {
    label: "Deleting tryout leaderboard entries...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutLeaderboardEntriesBatch",
    resultLabel: "tryout leaderboard entries",
  },
  {
    label: "Deleting user tryout stats...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteUserTryoutStatsBatch",
    resultLabel: "user tryout stats",
  },
  {
    label: "Deleting IRT scale publication queue...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtScalePublicationQueueBatch",
    resultLabel: "IRT scale publication queue entries",
  },
  {
    label: "Deleting IRT scale version items...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtScaleVersionItemsBatch",
    resultLabel: "IRT scale version items",
  },
  {
    label: "Deleting exercise item parameters...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteExerciseItemParametersBatch",
    resultLabel: "exercise item parameters",
  },
  {
    label: "Deleting IRT scale quality checks...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtScaleQualityChecksBatch",
    resultLabel: "IRT scale quality checks",
  },
  {
    label: "Deleting IRT scale quality refresh queue...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtScaleQualityRefreshQueueBatch",
    resultLabel: "IRT scale quality refresh queue entries",
  },
  {
    label: "Deleting IRT calibration queue...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtCalibrationQueueBatch",
    resultLabel: "IRT calibration queue entries",
  },
  {
    label: "Deleting IRT calibration attempts...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtCalibrationAttemptsBatch",
    resultLabel: "IRT calibration attempts",
  },
  {
    label: "Deleting IRT calibration cache stats...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtCalibrationCacheStatsBatch",
    resultLabel: "IRT calibration cache stats",
  },
  {
    label: "Deleting exercise attempts...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteExerciseAttemptsBatch",
    resultLabel: "exercise attempts",
  },
  {
    label: "Deleting tryout attempts...",
    mutationPath: "contentSync/mutations/maintenance:deleteTryoutAttemptsBatch",
    resultLabel: "tryout attempts",
  },
  {
    label: "Deleting tryout entitlements...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutEntitlementsBatch",
    resultLabel: "tryout entitlements",
  },
  {
    label: "Deleting tryout access grants...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutAccessGrantsBatch",
    resultLabel: "tryout access grants",
  },
  {
    label: "Deleting tryout access campaign products...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutAccessCampaignProductsBatch",
    resultLabel: "tryout access campaign products",
  },
  {
    label: "Deleting tryout access links...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutAccessLinksBatch",
    resultLabel: "tryout access links",
  },
  {
    label: "Deleting tryout access campaigns...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutAccessCampaignsBatch",
    resultLabel: "tryout access campaigns",
  },
  {
    label: "Deleting tryout catalog meta...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteTryoutCatalogMetaBatch",
    resultLabel: "tryout catalog meta rows",
  },
  {
    label: "Deleting tryout part sets...",
    mutationPath: "contentSync/mutations/maintenance:deleteTryoutPartSetsBatch",
    resultLabel: "tryout part sets",
  },
  {
    label: "Deleting IRT scale versions...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtScaleVersionsBatch",
    resultLabel: "IRT scale versions",
  },
  {
    label: "Deleting IRT calibration runs...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteIrtCalibrationRunsBatch",
    resultLabel: "IRT calibration runs",
  },
  {
    label: "Deleting tryouts...",
    mutationPath: "contentSync/mutations/maintenance:deleteTryoutsBatch",
    resultLabel: "tryouts",
  },
  {
    label: "Deleting exercise questions...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteExerciseQuestionsBatch",
    resultLabel: "exercise questions",
  },
  {
    label: "Deleting subject sections...",
    mutationPath:
      "contentSync/mutations/maintenance:deleteSubjectSectionsBatch",
    resultLabel: "subject sections",
  },
  {
    label: "Deleting exercise sets...",
    mutationPath: "contentSync/mutations/maintenance:deleteExerciseSetsBatch",
    resultLabel: "exercise sets",
  },
  {
    label: "Deleting subject topics...",
    mutationPath: "contentSync/mutations/maintenance:deleteSubjectTopicsBatch",
    resultLabel: "subject topics",
  },
  {
    label: "Deleting articles...",
    mutationPath: "contentSync/mutations/maintenance:deleteArticlesBatch",
    resultLabel: "articles",
  },
];

/** Deletes every row exposed by one bounded maintenance mutation. */
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

/** Deletes the full sync-managed content graph and its derived runtime rows. */
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
  log(`  Tryout Access Campaigns:${counts.tryoutAccessCampaigns}`);
  log(`  Tryout Access Products: ${counts.tryoutAccessCampaignProducts}`);
  log(`  Tryout Access Links:    ${counts.tryoutAccessLinks}`);
  log(`  Tryout Access Grants:   ${counts.tryoutAccessGrants}`);
  log(`  Tryouts:               ${counts.tryouts}`);
  log(`  Tryout Catalog Meta:   ${counts.tryoutCatalogMeta}`);
  log(`  User Entitlements:     ${counts.userTryoutEntitlements}`);
  log(`  Tryout Part Sets:      ${counts.tryoutPartSets}`);
  log(`  Tryout Attempts:       ${counts.tryoutAttempts}`);
  log(`  Tryout Part Attempts:  ${counts.tryoutPartAttempts}`);
  log(`  Tryout Leaderboard:    ${counts.tryoutLeaderboardEntries}`);
  log(`  User Tryout Stats:     ${counts.userTryoutStats}`);
  log(`  IRT Calibration Queue: ${counts.irtCalibrationQueue}`);
  log(`  IRT Calibration Rows:  ${counts.irtCalibrationAttempts}`);
  log(`  IRT Cache Stats:       ${counts.irtCalibrationCacheStats}`);
  log(`  IRT Calibration Runs:  ${counts.irtCalibrationRuns}`);
  log(`  IRT Scale Quality:     ${counts.irtScaleQualityChecks}`);
  log(`  IRT Scale Quality Q:   ${counts.irtScaleQualityRefreshQueue}`);
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
    counts.tryoutAccessCampaigns +
    counts.tryoutAccessCampaignProducts +
    counts.tryoutAccessLinks +
    counts.tryoutAccessGrants +
    counts.tryouts +
    counts.tryoutCatalogMeta +
    counts.userTryoutEntitlements +
    counts.tryoutPartSets +
    counts.tryoutAttempts +
    counts.tryoutPartAttempts +
    counts.tryoutLeaderboardEntries +
    counts.userTryoutStats +
    counts.irtCalibrationQueue +
    counts.irtCalibrationAttempts +
    counts.irtCalibrationCacheStats +
    counts.irtCalibrationRuns +
    counts.irtScaleQualityChecks +
    counts.irtScaleQualityRefreshQueue +
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
      log("  pnpm --filter @repo/backend sync:reset --prod --force");
    } else {
      log("  pnpm --filter @repo/backend sync:reset --force");
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
      "contentSync/mutations/maintenance:deleteAuthorsBatch",
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
    log("  pnpm --filter @repo/backend sync:prod");
  } else {
    log("  pnpm --filter @repo/backend sync");
  }
};
