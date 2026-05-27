import type { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { callConvex } from "@repo/backend/scripts/sync-content/convex";
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
import { Effect } from "effect";

interface ResetStep {
  label: string;
  mutationRef: Ref.AnyMutation;
  resultLabel: string;
}

const RESET_STEPS: ResetStep[] = [
  {
    label: "Deleting content search rows...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteContentSearchBatch,
    resultLabel: "content search rows",
  },
  {
    label: "Deleting content authors...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteContentAuthorsBatch,
    resultLabel: "content authors",
  },
  {
    label: "Deleting article references...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteArticleReferencesBatch,
    resultLabel: "article references",
  },
  {
    label: "Deleting exercise choices...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteExerciseChoicesBatch,
    resultLabel: "exercise choices",
  },
  {
    label: "Deleting exercise answers...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteExerciseAnswersBatch,
    resultLabel: "exercise answers",
  },
  {
    label: "Deleting tryout part attempts...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutPartAttemptsBatch,
    resultLabel: "tryout part attempts",
  },
  {
    label: "Deleting tryout leaderboard entries...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutLeaderboardEntriesBatch,
    resultLabel: "tryout leaderboard entries",
  },
  {
    label: "Deleting user tryout stats...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteUserTryoutStatsBatch,
    resultLabel: "user tryout stats",
  },
  {
    label: "Deleting IRT scale publication queue...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtScalePublicationQueueBatch,
    resultLabel: "IRT scale publication queue entries",
  },
  {
    label: "Deleting IRT scale version items...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtScaleVersionItemsBatch,
    resultLabel: "IRT scale version items",
  },
  {
    label: "Deleting exercise item parameters...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteExerciseItemParametersBatch,
    resultLabel: "exercise item parameters",
  },
  {
    label: "Deleting IRT scale quality checks...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtScaleQualityChecksBatch,
    resultLabel: "IRT scale quality checks",
  },
  {
    label: "Deleting IRT scale quality refresh queue...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtScaleQualityRefreshQueueBatch,
    resultLabel: "IRT scale quality refresh queue entries",
  },
  {
    label: "Deleting IRT calibration queue...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtCalibrationQueueBatch,
    resultLabel: "IRT calibration queue entries",
  },
  {
    label: "Deleting IRT calibration attempts...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtCalibrationAttemptsBatch,
    resultLabel: "IRT calibration attempts",
  },
  {
    label: "Deleting IRT calibration cache stats...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtCalibrationCacheStatsBatch,
    resultLabel: "IRT calibration cache stats",
  },
  {
    label: "Deleting exercise attempts...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteExerciseAttemptsBatch,
    resultLabel: "exercise attempts",
  },
  {
    label: "Deleting tryout attempts...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteTryoutAttemptsBatch,
    resultLabel: "tryout attempts",
  },
  {
    label: "Deleting tryout entitlements...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutEntitlementsBatch,
    resultLabel: "tryout entitlements",
  },
  {
    label: "Deleting tryout access grants...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutAccessGrantsBatch,
    resultLabel: "tryout access grants",
  },
  {
    label: "Deleting tryout access campaign products...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutAccessCampaignProductsBatch,
    resultLabel: "tryout access campaign products",
  },
  {
    label: "Deleting tryout access links...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutAccessLinksBatch,
    resultLabel: "tryout access links",
  },
  {
    label: "Deleting tryout access campaigns...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutAccessCampaignsBatch,
    resultLabel: "tryout access campaigns",
  },
  {
    label: "Deleting tryout catalog meta...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteTryoutCatalogMetaBatch,
    resultLabel: "tryout catalog meta rows",
  },
  {
    label: "Deleting tryout part sets...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteTryoutPartSetsBatch,
    resultLabel: "tryout part sets",
  },
  {
    label: "Deleting IRT scale versions...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtScaleVersionsBatch,
    resultLabel: "IRT scale versions",
  },
  {
    label: "Deleting IRT calibration runs...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteIrtCalibrationRunsBatch,
    resultLabel: "IRT calibration runs",
  },
  {
    label: "Deleting tryouts...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteTryoutsBatch,
    resultLabel: "tryouts",
  },
  {
    label: "Deleting exercise questions...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteExerciseQuestionsBatch,
    resultLabel: "exercise questions",
  },
  {
    label: "Deleting subject sections...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance
        .deleteSubjectSectionsBatch,
    resultLabel: "subject sections",
  },
  {
    label: "Deleting exercise sets...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteExerciseSetsBatch,
    resultLabel: "exercise sets",
  },
  {
    label: "Deleting subject topics...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteSubjectTopicsBatch,
    resultLabel: "subject topics",
  },
  {
    label: "Deleting articles...",
    mutationRef:
      refs.internal.contentSync.mutations.maintenance.deleteArticlesBatch,
    resultLabel: "articles",
  },
];

/** Deletes every row exposed by one bounded maintenance mutation. */
const deleteAllBatched = Effect.fn("sync.reset.deleteAllBatched")(function* (
  config: ConvexConfig,
  mutationRef: Ref.AnyMutation,
  label: string
) {
  let totalDeleted = 0;
  let batchNum = 1;
  let hasMore = true;

  while (hasMore) {
    const result = yield* callConvex(
      config,
      "mutation",
      mutationRef,
      {},
      BatchDeleteResultSchema
    );
    totalDeleted += result.deleted;
    hasMore = result.hasMore;

    if (result.deleted > 0) {
      yield* Effect.sync(() =>
        process.stdout.write(
          `\r  Batch ${batchNum}: deleted ${totalDeleted} ${label}...`
        )
      );
      batchNum++;
    }
  }

  if (totalDeleted > 0) {
    yield* Effect.sync(() => process.stdout.write("\n"));
  }
  return totalDeleted;
});

/** Deletes the full sync-managed content graph and its derived runtime rows. */
export const reset = Effect.fn("sync.reset")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
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
  const counts = yield* getContentCounts(config);

  log(`  Content Search:        ${counts.contentSearch}`);
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
  const totalDerived = counts.contentSearch;

  log(`\n  Total content items:  ${totalContent}`);
  log(`  Total related items:  ${totalRelated}`);
  log(`  Total runtime items:  ${totalRuntime}`);
  log(`  Total derived items:  ${totalDerived}`);

  if (
    totalContent === 0 &&
    totalRelated === 0 &&
    totalRuntime === 0 &&
    totalDerived === 0
  ) {
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
    const deleted = yield* deleteAllBatched(
      config,
      step.mutationRef,
      step.resultLabel
    );
    logSuccess(`  Deleted ${deleted} ${step.resultLabel}`);
    totalDeleted += deleted;
  }

  if (options.authors) {
    log("Deleting authors...");
    const authorsDeleted = yield* deleteAllBatched(
      config,
      refs.internal.contentSync.mutations.maintenance.deleteAuthorsBatch,
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
  yield* clearSyncState(options.prod ?? false);
  log("Cleared sync state file");

  log("\nTo re-sync content, run:");
  if (options.prod) {
    log("  pnpm --filter @repo/backend sync:prod");
  } else {
    log("  pnpm --filter @repo/backend sync");
  }
});
