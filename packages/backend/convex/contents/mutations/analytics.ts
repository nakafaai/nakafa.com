import { internal } from "@repo/backend/convex/_generated/api";
import {
  CONTENT_ANALYTICS_BATCH_SIZE,
  CONTENT_ANALYTICS_LEASE_DURATION_MS,
  CONTENT_ANALYTICS_PARTITIONS,
} from "@repo/backend/convex/contents/constants";
import { isContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import { applyContentAnalyticsBatch } from "@repo/backend/convex/contents/helpers/writes";
import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { ConvexError, v } from "convex/values";

/** Schedules one worker per idle analytics partition with queued rows. */
export const scheduleContentAnalyticsPartitions = internalMutation({
  args: {},
  returns: v.object({
    enqueuedPartitions: v.number(),
  }),
  handler: async (ctx) => {
    for (const partition of CONTENT_ANALYTICS_PARTITIONS) {
      await ctx.scheduler.runAfter(
        0,
        internal.contents.mutations.analytics.scheduleContentAnalyticsPartition,
        { partition }
      );
    }

    return {
      enqueuedPartitions: CONTENT_ANALYTICS_PARTITIONS.length,
    };
  },
});

/** Claims one partition lease and starts a worker when backlog exists. */
export const scheduleContentAnalyticsPartition = internalMutation({
  args: {
    partition: v.number(),
  },
  returns: v.object({
    createdPartition: v.boolean(),
    scheduled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!isContentAnalyticsPartition(args.partition)) {
      throw new ConvexError({
        code: "INVALID_CONTENT_ANALYTICS_PARTITION",
        message: "Content analytics partition is out of range.",
      });
    }

    const hasBacklog = await ctx.db
      .query("contentViewAnalyticsQueue")
      .withIndex("by_partition", (q) => q.eq("partition", args.partition))
      .take(1);

    if (hasBacklog.length === 0) {
      return {
        createdPartition: false,
        scheduled: false,
      };
    }

    const partitionRow = await ctx.db
      .query("contentAnalyticsPartitions")
      .withIndex("by_partition", (q) => q.eq("partition", args.partition))
      .first();
    const now = Date.now();

    let createdPartition = false;
    let partitionRowId = partitionRow?._id;
    const leaseExpiresAt = partitionRow?.leaseExpiresAt ?? 0;
    let leaseVersion = partitionRow?.leaseVersion ?? 0;

    if (!partitionRowId) {
      partitionRowId = await ctx.db.insert("contentAnalyticsPartitions", {
        leaseExpiresAt: 0,
        leaseVersion: 0,
        partition: args.partition,
      });
      createdPartition = true;
    }

    if (leaseExpiresAt > now) {
      return {
        createdPartition,
        scheduled: false,
      };
    }

    leaseVersion += 1;

    await ctx.db.patch("contentAnalyticsPartitions", partitionRowId, {
      leaseExpiresAt: now + CONTENT_ANALYTICS_LEASE_DURATION_MS,
      leaseVersion,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.contents.mutations.analytics.processContentAnalyticsPartition,
      {
        leaseVersion,
        partition: args.partition,
      }
    );

    return {
      createdPartition,
      scheduled: true,
    };
  },
});

/** Drains one leased analytics partition into derived popularity tables. */
export const processContentAnalyticsPartition = internalMutation({
  args: {
    leaseVersion: v.number(),
    partition: v.number(),
  },
  returns: v.object({
    hasMore: v.boolean(),
    partition: v.number(),
    processed: v.number(),
    skipped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!isContentAnalyticsPartition(args.partition)) {
      throw new ConvexError({
        code: "INVALID_CONTENT_ANALYTICS_PARTITION",
        message: "Content analytics partition is out of range.",
      });
    }

    const now = Date.now();
    const partitionRow = await ctx.db
      .query("contentAnalyticsPartitions")
      .withIndex("by_partition", (q) => q.eq("partition", args.partition))
      .unique();

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

    const queueItems = await ctx.db
      .query("contentViewAnalyticsQueue")
      .withIndex("by_partition", (q) => q.eq("partition", args.partition))
      .take(CONTENT_ANALYTICS_BATCH_SIZE);

    if (queueItems.length === 0) {
      await ctx.db.patch("contentAnalyticsPartitions", partitionRow._id, {
        lastProcessedAt: now,
        leaseExpiresAt: 0,
      });

      return {
        hasMore: false,
        partition: args.partition,
        processed: 0,
        skipped: false,
      };
    }

    await applyContentAnalyticsBatch(ctx, queueItems);

    for (const queueItem of queueItems) {
      await ctx.db.delete("contentViewAnalyticsQueue", queueItem._id);
    }

    const hasMore = queueItems.length === CONTENT_ANALYTICS_BATCH_SIZE;

    if (hasMore) {
      await ctx.db.patch("contentAnalyticsPartitions", partitionRow._id, {
        lastProcessedAt: now,
        leaseExpiresAt: now + CONTENT_ANALYTICS_LEASE_DURATION_MS,
      });

      await ctx.scheduler.runAfter(
        0,
        internal.contents.mutations.analytics.processContentAnalyticsPartition,
        args
      );
    } else {
      await ctx.db.patch("contentAnalyticsPartitions", partitionRow._id, {
        lastProcessedAt: now,
        leaseExpiresAt: 0,
      });
    }

    logger.info("Processed content analytics partition batch", {
      hasMore,
      partition: args.partition,
      processed: queueItems.length,
    });

    return {
      hasMore,
      partition: args.partition,
      processed: queueItems.length,
      skipped: false,
    };
  },
});
