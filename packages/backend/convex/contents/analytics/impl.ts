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
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
  CONTENT_ANALYTICS_PARTITIONS,
} from "@repo/backend/convex/contents/constants";
import { isContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import { isPopularityResetting } from "@repo/backend/convex/contents/reset/state";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

/** Generated internal mutation reference that claims analytics partitions. */
type ScheduleContentAnalyticsPartitionReference = FunctionReference<
  "mutation",
  "internal",
  ScheduleContentAnalyticsPartitionArgs,
  ScheduleContentAnalyticsPartitionResult
>;

/** Generated worker reference started after one partition lease is claimed. */
type ProcessContentAnalyticsPartitionReference = FunctionReference<
  "mutation",
  "internal",
  ProcessContentAnalyticsPartitionArgs,
  ProcessContentAnalyticsPartitionResult
>;

/** Schedules worker attempts only for partitions that currently have queued views. */
export const scheduleAllContentAnalyticsPartitions = Effect.fn(
  "contents.analytics.scheduleAllContentAnalyticsPartitions"
)(function* (
  ctx: MutationCtx,
  schedulePartition: ScheduleContentAnalyticsPartitionReference
) {
  if (yield* isPopularityResetting(ctx.db)) {
    return { enqueuedPartitions: 0 };
  }

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
      try: () => ctx.scheduler.runAfter(0, schedulePartition, { partition }),
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
      createdPartition: false,
      scheduled: false,
    };
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
      ctx.scheduler.runAfter(0, processPartition, {
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
