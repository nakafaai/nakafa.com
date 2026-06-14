import { internal } from "@repo/backend/convex/_generated/api";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import { getContentCounts } from "@repo/backend/scripts/sync-content/counts";
import {
  formatDuration,
  log,
  logSuccess,
  logWarning,
} from "@repo/backend/scripts/sync-content/logging";
import { BatchDeleteResultSchema } from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";
import { Effect } from "effect";

type BatchDeleteMutation = FunctionReference<
  "mutation",
  "internal",
  DefaultFunctionArgs,
  { deleted: number; hasMore: boolean }
>;

interface ResetAnalyticsStep {
  label: string;
  mutation: BatchDeleteMutation;
  resultLabel: string;
}

const RESET_ANALYTICS_STEPS: ResetAnalyticsStep[] = [
  {
    label: "Deleting content view analytics queue...",
    mutation:
      internal.contentSync.reset.internal.deleteContentViewAnalyticsQueueBatch,
    resultLabel: "content view analytics queue rows",
  },
  {
    label: "Deleting content analytics partition leases...",
    mutation:
      internal.contentSync.reset.internal.deleteContentAnalyticsPartitionsBatch,
    resultLabel: "content analytics partition leases",
  },
  {
    label: "Deleting content view rows...",
    mutation: internal.contentSync.reset.internal.deleteContentViewsBatch,
    resultLabel: "content view rows",
  },
  {
    label: "Deleting learning popularity rows...",
    mutation: internal.contentSync.reset.internal.deleteLearningPopularityBatch,
    resultLabel: "learning popularity rows",
  },
  {
    label: "Deleting learning trending bucket rows...",
    mutation:
      internal.contentSync.reset.internal.deleteLearningTrendingBucketsBatch,
    resultLabel: "learning trending bucket rows",
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

/** Deletes graph-derived analytics rows so new traffic starts from clean graph identity. */
export const resetAnalytics = Effect.fn("sync.resetAnalytics")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  log("=== RESET CONTENT ANALYTICS ===\n");
  log(
    "This deletes content view history, analytics queue rows, popularity counts, trending buckets, and analytics partition leases."
  );
  log(
    "New product traffic will repopulate these graph-backed analytics tables after strict code is deployed.\n"
  );

  if (options.prod) {
    logWarning("PRODUCTION DATABASE SELECTED!");
    logWarning(
      "This will permanently delete production content view history and derived analytics rows.\n"
    );
  }

  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  const counts = yield* getContentCounts(config);
  const totalAnalyticsRows =
    counts.contentViews +
    counts.contentViewAnalyticsQueue +
    counts.contentAnalyticsPartitions +
    counts.learningPopularity +
    counts.learningTrendingBuckets;

  log("Current content analytics database contents:\n");
  log(`  Content Views:        ${counts.contentViews}`);
  log(`  Analytics Queue:      ${counts.contentViewAnalyticsQueue}`);
  log(`  Analytics Partitions: ${counts.contentAnalyticsPartitions}`);
  log(`  Learning Popularity:  ${counts.learningPopularity}`);
  log(`  Learning Trending:    ${counts.learningTrendingBuckets}`);
  log(`\n  Total analytics rows: ${totalAnalyticsRows}`);

  if (totalAnalyticsRows === 0) {
    logSuccess("\nContent analytics read models are already empty.");
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
