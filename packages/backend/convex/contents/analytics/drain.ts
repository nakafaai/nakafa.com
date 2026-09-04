import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_ANALYTICS_GROUP_SIZE,
  CONTENT_ANALYTICS_PAGE_BYTES,
  hasContentAnalyticsHeadroom,
} from "@repo/backend/convex/contents/analytics/budget";
import {
  InvalidContentAnalyticsPartitionError,
  invalidContentAnalyticsPartitionCode,
  type ProcessContentAnalyticsPartitionArgs,
  type ProcessContentAnalyticsPartitionResult,
  toContentAnalyticsIoError,
} from "@repo/backend/convex/contents/analytics/spec";
import {
  CONTENT_ANALYTICS_BATCH_SIZE,
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
} from "@repo/backend/convex/contents/constants";
import { isContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import { applyContentAnalyticsBatch } from "@repo/backend/convex/contents/metrics/apply";
import { groupMetricsQueueItems } from "@repo/backend/convex/contents/metrics/batch";
import { isPopularityResetting } from "@repo/backend/convex/contents/reset/state";
import { logger } from "@repo/backend/convex/utils/logger";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

/** Generated internal mutation reference that continues one claimed drain. */
type ProcessContentAnalyticsPartitionReference = FunctionReference<
  "mutation",
  "internal",
  ProcessContentAnalyticsPartitionArgs,
  ProcessContentAnalyticsPartitionResult
>;

/** Applies and acknowledges one complete popularity identity group. */
const applyQueueGroup = Effect.fn("contents.analytics.applyQueueGroup")(
  function* (
    ctx: MutationCtx,
    queueItems: Parameters<typeof groupMetricsQueueItems>[0],
    updatedAt: number
  ) {
    yield* applyContentAnalyticsBatch(ctx, { queueItems, updatedAt });

    for (const queueItem of queueItems) {
      yield* Effect.tryPromise({
        try: () => ctx.db.delete("learningEngagementQueue", queueItem._id),
        catch: toContentAnalyticsIoError,
      });
    }
  }
);

/** Drains bounded identity groups while preserving finalization headroom. */
export const processClaimedContentAnalyticsPartition = Effect.fn(
  "contents.analytics.processClaimedContentAnalyticsPartition"
)(function* (
  ctx: MutationCtx,
  args: ProcessContentAnalyticsPartitionArgs,
  processPartition: ProcessContentAnalyticsPartitionReference
) {
  if (!isContentAnalyticsPartition(args.partition)) {
    return yield* new InvalidContentAnalyticsPartitionError({
      code: invalidContentAnalyticsPartitionCode,
      message: "Content analytics partition is out of range.",
    });
  }

  if (yield* isPopularityResetting(ctx.db)) {
    return {
      hasMore: false,
      partition: args.partition,
      processed: 0,
      skipped: true,
    };
  }

  const now = yield* Clock.currentTimeMillis;
  const partitionRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("contentAnalyticsPartitions")
        .withIndex("by_partition", (q) => q.eq("partition", args.partition))
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (
    !partitionRow ||
    partitionRow.leaseVersion !== args.leaseVersion ||
    partitionRow.leaseExpiresAt < now
  ) {
    return {
      hasMore: false,
      partition: args.partition,
      processed: 0,
      skipped: true,
    };
  }

  const queuePage = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningEngagementQueue")
        .withIndex("by_partition_and_insertedAt", (q) =>
          q.eq("partition", args.partition)
        )
        .paginate({
          cursor: null,
          maximumBytesRead: CONTENT_ANALYTICS_PAGE_BYTES,
          maximumRowsRead: CONTENT_ANALYTICS_BATCH_SIZE,
          numItems: CONTENT_ANALYTICS_BATCH_SIZE,
        }),
    catch: toContentAnalyticsIoError,
  });

  let processed = 0;
  const groups = groupMetricsQueueItems(
    queuePage.page,
    CONTENT_ANALYTICS_GROUP_SIZE
  );

  for (const group of groups) {
    yield* applyQueueGroup(ctx, group, now);
    processed += group.length;

    const metrics = yield* Effect.tryPromise({
      try: () => ctx.meta.getTransactionMetrics(),
      catch: toContentAnalyticsIoError,
    });
    if (!hasContentAnalyticsHeadroom(metrics)) {
      break;
    }
  }

  const hasMore = processed < queuePage.page.length || !queuePage.isDone;
  const leaseExpiresAt = hasMore
    ? now + CONTENT_ANALYTICS_LEASE_DURATION_MS
    : 0;

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("contentAnalyticsPartitions", partitionRow._id, {
        lastProcessedAt: now,
        leaseExpiresAt,
      }),
    catch: toContentAnalyticsIoError,
  });

  if (hasMore) {
    yield* Effect.tryPromise({
      try: () => ctx.scheduler.runAfter(0, processPartition, args),
      catch: toContentAnalyticsIoError,
    });
  }

  yield* Effect.sync(() =>
    logger.info("Processed content analytics partition batch", {
      hasMore,
      partition: args.partition,
      processed,
    })
  );

  return {
    hasMore,
    partition: args.partition,
    processed,
    skipped: false,
  };
});
