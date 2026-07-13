import { internal } from "@repo/backend/convex/_generated/api";
import {
  formatDuration,
  log,
  logSuccess,
  logWarning,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { BatchDeleteResultSchema } from "@repo/backend/scripts/sync-content/contract/inspection";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import { getContentCounts } from "@repo/backend/scripts/sync-content/convex/counts";
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";
import { Effect } from "effect";

type BatchDeleteMutation = FunctionReference<
  "mutation",
  "internal",
  DefaultFunctionArgs,
  { deleted: number; hasMore: boolean }
>;

/** One bounded Convex table reset step in the analytics reset sequence. */
interface ResetAnalyticsStep {
  label: string;
  mutation: BatchDeleteMutation;
  resultLabel: string;
}

const RESET_ANALYTICS_STEPS: ResetAnalyticsStep[] = [
  {
    label: "Deleting learning engagement queue...",
    mutation:
      internal.contentSync.reset.internal.deleteLearningEngagementQueueBatch,
    resultLabel: "learning engagement queue rows",
  },
  {
    label: "Deleting content analytics partition leases...",
    mutation:
      internal.contentSync.reset.internal.deleteContentAnalyticsPartitionsBatch,
    resultLabel: "content analytics partition leases",
  },
  {
    label: "Deleting learning popularity signal rows...",
    mutation:
      internal.contentSync.reset.internal.deleteLearningPopularitySignalsBatch,
    resultLabel: "learning popularity signal rows",
  },
  {
    label: "Deleting learning popularity viewer signal rows...",
    mutation:
      internal.contentSync.reset.internal
        .deleteLearningPopularityViewerSignalsBatch,
    resultLabel: "learning popularity viewer signal rows",
  },
  {
    label: "Deleting learning popularity counter rows...",
    mutation:
      internal.contentSync.reset.internal.deleteLearningPopularityCountersBatch,
    resultLabel: "learning popularity counter rows",
  },
];

/** Deletes every row reachable by one analytics batch reset mutation. */
const deleteAllBatched = Effect.fn("sync.resetAnalytics.deleteAllBatched")(
  function* (
    config: ConvexConfig,
    mutation: BatchDeleteMutation,
    label: string
  ) {
    let totalDeleted = 0;
    let batchNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const result = yield* callConvexMutation(
        config,
        mutation,
        {},
        BatchDeleteResultSchema
      );
      totalDeleted += result.deleted;
      hasMore = result.hasMore;

      if (result.deleted === 0) {
        continue;
      }

      yield* Effect.sync(() =>
        process.stdout.write(
          `\r  Batch ${batchNumber}: deleted ${totalDeleted} ${label}...`
        )
      );
      batchNumber += 1;
    }

    if (totalDeleted > 0) {
      yield* Effect.sync(() => process.stdout.write("\n"));
    }

    return totalDeleted;
  }
);

/** Deletes rebuildable analytics projections while preserving learner history. */
export const resetAnalytics = Effect.fn("sync.resetAnalytics")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  log("=== RESET CONTENT ANALYTICS ===\n");
  log(
    "This deletes analytics queue rows, popularity read models, and analytics partition leases."
  );
  log("Durable learning views and Continue Learning recents are preserved.\n");

  if (options.prod) {
    logWarning("PRODUCTION DATABASE SELECTED!");
    logWarning(
      "This will permanently delete rebuildable production analytics rows.\n"
    );
  }

  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  const counts = yield* getContentCounts(config);
  const totalResettableAnalyticsRows =
    counts.learningEngagementQueue +
    counts.contentAnalyticsPartitions +
    counts.learningPopularityViewerSignals +
    counts.learningPopularitySignals +
    counts.learningPopularityCounters;

  log("Current content analytics database contents:\n");
  log(`  Learning Views (preserved): ${counts.learningViews}`);
  log(`  Engagement Queue:     ${counts.learningEngagementQueue}`);
  log(`  Analytics Partitions: ${counts.contentAnalyticsPartitions}`);
  log(`  User Recents (preserved): ${counts.userLearningRecents}`);
  log(`  Viewer Signals:       ${counts.learningPopularityViewerSignals}`);
  log(`  Popularity Signals:   ${counts.learningPopularitySignals}`);
  log(`  Popularity Counters:  ${counts.learningPopularityCounters}`);
  log(`\n  Total resettable analytics rows: ${totalResettableAnalyticsRows}`);
  log(
    `  Total preserved learner rows: ${counts.learningViews + counts.userLearningRecents}`
  );

  if (totalResettableAnalyticsRows === 0) {
    logSuccess("\nResettable content analytics rows are already empty.");
    return;
  }

  if (!options.force) {
    log("\nTo delete content analytics rows, run:");
    if (options.prod) {
      log("  pnpm --filter @repo/backend sync:prod:reset:analytics --force");
      return;
    }

    log("  pnpm --filter @repo/backend sync:reset:analytics --force");
    return;
  }

  log("\nDeleting content analytics rows (in dependency order)...\n");
  const startTime = performance.now();
  let totalDeleted = 0;

  for (const [index, step] of RESET_ANALYTICS_STEPS.entries()) {
    log(`${index + 1}/${RESET_ANALYTICS_STEPS.length} ${step.label}`);
    const deleted = yield* deleteAllBatched(
      config,
      step.mutation,
      step.resultLabel
    );
    logSuccess(`  Deleted ${deleted} ${step.resultLabel}`);
    totalDeleted += deleted;
  }

  log("\n=== RESET CONTENT ANALYTICS COMPLETE ===\n");
  logSuccess(`Deleted ${totalDeleted} analytics rows across content tables`);
  log(`Duration: ${formatDuration(performance.now() - startTime)}`);
});
