import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  InvalidContentAnalyticsPartitionError,
  invalidContentAnalyticsPartitionCode,
  type ProcessContentAnalyticsPartitionArgs,
  type ProcessContentAnalyticsPartitionResult,
  type ScheduleContentAnalyticsPartitionArgs,
  type ScheduleContentAnalyticsPartitionResult,
  toContentAnalyticsIoError,
} from "@repo/backend/convex/contents/analytics/spec";
import {
  CONTENT_ANALYTICS_BATCH_SIZE,
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
  CONTENT_ANALYTICS_PARTITIONS,
} from "@repo/backend/convex/contents/constants";
import { isContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import { applyContentAnalyticsBatch } from "@repo/backend/convex/contents/metrics/apply";
import { logger } from "@repo/backend/convex/utils/logger";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

/** Internal scheduler function refs used to lease and drain analytics partitions. */
export interface ContentAnalyticsSchedulerTargets {
  readonly processPartition: FunctionReference<
    "mutation",
    "internal",
    ProcessContentAnalyticsPartitionArgs,
    ProcessContentAnalyticsPartitionResult
  >;
  readonly schedulePartition: FunctionReference<
    "mutation",
    "internal",
    ScheduleContentAnalyticsPartitionArgs,
    ScheduleContentAnalyticsPartitionResult
  >;
}

/** Schedules worker attempts only for partitions that currently have queued views. */
export const scheduleAllContentAnalyticsPartitions = Effect.fn(
  "contents.analytics.scheduleAllContentAnalyticsPartitions"
)(function* (ctx: MutationCtx, targets: ContentAnalyticsSchedulerTargets) {
  let enqueuedPartitions = 0;

  for (const partition of CONTENT_ANALYTICS_PARTITIONS) {
    const queuedItem = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("learningEngagementQueue")
          .withIndex("by_partition_and_insertedAt", (q) =>
            q.eq("partition", partition)
          )
          .first(),
      catch: toContentAnalyticsIoError,
    });

    if (!queuedItem) {
      continue;
    }

    yield* Effect.tryPromise({
      try: () =>
        ctx.scheduler.runAfter(0, targets.schedulePartition, {
          partition,
        }),
      catch: toContentAnalyticsIoError,
    });

    enqueuedPartitions += 1;
  }

  return {
    enqueuedPartitions,
  };
});

/**
 * Claims one partition lease and starts one bounded drain worker.
 *
 * The queue existence read intentionally happens before the lease write so cron
 * jobs do not create OCC contention on empty partitions.
 * @see https://docs.convex.dev/database/advanced/occ
 */
export const claimContentAnalyticsPartition = Effect.fn(
  "contents.analytics.claimContentAnalyticsPartition"
)(function* (
  ctx: MutationCtx,
  args: ScheduleContentAnalyticsPartitionArgs,
  targets: ContentAnalyticsSchedulerTargets
) {
  if (!isContentAnalyticsPartition(args.partition)) {
    return yield* Effect.fail(
      new InvalidContentAnalyticsPartitionError({
        code: invalidContentAnalyticsPartitionCode,
        message: "Content analytics partition is out of range.",
      })
    );
  }

  const queuedItem = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningEngagementQueue")
        .withIndex("by_partition_and_insertedAt", (q) =>
          q.eq("partition", args.partition)
        )
        .first(),
    catch: toContentAnalyticsIoError,
  });

  if (!queuedItem) {
    return {
      createdPartition: false,
      scheduled: false,
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

  let createdPartition = false;
  let partitionRowId = partitionRow?._id;
  const leaseExpiresAt = partitionRow?.leaseExpiresAt ?? 0;
  let leaseVersion = partitionRow?.leaseVersion ?? 0;

  if (leaseExpiresAt > now) {
    return {
      createdPartition,
      scheduled: false,
    };
  }

  if (!partitionRowId) {
    partitionRowId = yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("contentAnalyticsPartitions", {
          leaseExpiresAt: 0,
          leaseVersion: 0,
          partition: args.partition,
        }),
      catch: toContentAnalyticsIoError,
    });
    createdPartition = true;
  }

  leaseVersion += 1;

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("contentAnalyticsPartitions", partitionRowId, {
        leaseExpiresAt: now + CONTENT_ANALYTICS_LEASE_DURATION_MS,
        leaseVersion,
      }),
    catch: toContentAnalyticsIoError,
  });

  yield* Effect.tryPromise({
    try: () =>
      ctx.scheduler.runAfter(0, targets.processPartition, {
        leaseVersion,
        partition: args.partition,
      }),
    catch: toContentAnalyticsIoError,
  });

  return {
    createdPartition,
    scheduled: true,
  };
});

/** Drains one leased analytics partition into derived popularity tables. */
export const processClaimedContentAnalyticsPartition = Effect.fn(
  "contents.analytics.processClaimedContentAnalyticsPartition"
)(function* (
  ctx: MutationCtx,
  args: ProcessContentAnalyticsPartitionArgs,
  targets: ContentAnalyticsSchedulerTargets
) {
  if (!isContentAnalyticsPartition(args.partition)) {
    return yield* Effect.fail(
      new InvalidContentAnalyticsPartitionError({
        code: invalidContentAnalyticsPartitionCode,
        message: "Content analytics partition is out of range.",
      })
    );
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

  if (!partitionRow) {
    return {
      hasMore: false,
      partition: args.partition,
      processed: 0,
      skipped: true,
    };
  }

  if (partitionRow.leaseVersion !== args.leaseVersion) {
    return {
      hasMore: false,
      partition: args.partition,
      processed: 0,
      skipped: true,
    };
  }

  if (partitionRow.leaseExpiresAt < now) {
    return {
      hasMore: false,
      partition: args.partition,
      processed: 0,
      skipped: true,
    };
  }

  const queueItems = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningEngagementQueue")
        .withIndex("by_partition_and_insertedAt", (q) =>
          q.eq("partition", args.partition)
        )
        .take(CONTENT_ANALYTICS_BATCH_SIZE),
    catch: toContentAnalyticsIoError,
  });

  if (queueItems.length === 0) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch("contentAnalyticsPartitions", partitionRow._id, {
          lastProcessedAt: now,
          leaseExpiresAt: 0,
        }),
      catch: toContentAnalyticsIoError,
    });

    return {
      hasMore: false,
      partition: args.partition,
      processed: 0,
      skipped: false,
    };
  }

  yield* applyContentAnalyticsBatch(ctx, {
    queueItems,
    updatedAt: now,
  });

  for (const queueItem of queueItems) {
    yield* Effect.tryPromise({
      try: () => ctx.db.delete("learningEngagementQueue", queueItem._id),
      catch: toContentAnalyticsIoError,
    });
  }

  const hasMore = queueItems.length === CONTENT_ANALYTICS_BATCH_SIZE;
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
      try: () => ctx.scheduler.runAfter(0, targets.processPartition, args),
      catch: toContentAnalyticsIoError,
    });
  }

  yield* Effect.sync(() =>
    logger.info("Processed content analytics partition batch", {
      hasMore,
      partition: args.partition,
      processed: queueItems.length,
    })
  );

  return {
    hasMore,
    partition: args.partition,
    processed: queueItems.length,
    skipped: false,
  };
});
