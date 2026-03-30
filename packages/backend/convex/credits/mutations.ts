import { CLEANUP_CONFIG } from "@repo/backend/convex/credits/constants";
import { getCreditResetQueuePartition } from "@repo/backend/convex/credits/helpers/queue";
import { resetUserCredits } from "@repo/backend/convex/credits/utils";
import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Create a credit reset job record.
 */
export const createResetJob = internalMutation({
  args: {
    jobType: literals("free-daily", "pro-monthly"),
    resetTimestamp: v.number(),
  },
  returns: v.id("creditResetJobs"),
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("creditResetJobs", {
      jobType: args.jobType,
      status: "running",
      startedAt: Date.now(),
      resetTimestamp: args.resetTimestamp,
      totalUsers: 0,
      processedUsers: 0,
    });

    logger.info("Credit reset job created", {
      jobId,
      jobType: args.jobType,
      resetTimestamp: args.resetTimestamp,
    });

    return jobId;
  },
});

/**
 * Populate queue with a single batch of users.
 * Returns cursor and count for next batch.
 * Following Convex best practice: Keep mutations within limits by batching via workflow.
 * Reference: https://docs.convex.dev/production/state/limits
 */
export const populateQueueBatch = internalMutation({
  args: {
    jobId: v.id("creditResetJobs"),
    plan: literals("free", "pro"),
    resetTimestamp: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    usersAdded: v.number(),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Use Convex built-in pagination - best practice for large datasets
    // Reference: https://docs.convex.dev/database/pagination
    // This automatically handles cursor management and respects Convex limits
    const results = await ctx.db
      .query("users")
      .withIndex("by_plan_and_creditsResetAt", (idx) =>
        idx.eq("plan", args.plan).lt("creditsResetAt", args.resetTimestamp)
      )
      .paginate(args.paginationOpts);

    // Insert users into queue
    for (const user of results.page) {
      await ctx.db.insert("creditResetQueue", {
        userId: user._id,
        plan: args.plan,
        resetTimestamp: args.resetTimestamp,
        partition: getCreditResetQueuePartition(user._id),
        status: "pending",
      });
    }

    logger.info("Queue batch populated", {
      jobId: args.jobId,
      plan: args.plan,
      batchSize: results.page.length,
      isDone: results.isDone,
    });

    return {
      usersAdded: results.page.length,
      isDone: results.isDone,
      continueCursor: results.continueCursor,
    };
  },
});

/**
 * Update job total users count.
 */
export const updateJobTotalUsers = internalMutation({
  args: {
    jobId: v.id("creditResetJobs"),
    totalUsers: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("creditResetJobs", args.jobId, {
      totalUsers: args.totalUsers,
    });
    return null;
  },
});

/**
 * Atomically claim pending queue items for processing.
 */
export const claimQueueItems = internalMutation({
  args: {
    plan: literals("free", "pro"),
    resetTimestamp: v.number(),
    partition: v.number(),
    batchSize: v.number(),
  },
  returns: v.array(
    v.object({
      queueId: v.id("creditResetQueue"),
      userId: v.id("users"),
    })
  ),
  handler: async (ctx, args) => {
    const pendingItems = await ctx.db
      .query("creditResetQueue")
      .withIndex("by_plan_and_resetTimestamp_and_partition_and_status", (idx) =>
        idx
          .eq("plan", args.plan)
          .eq("resetTimestamp", args.resetTimestamp)
          .eq("partition", args.partition)
          .eq("status", "pending")
      )
      .take(args.batchSize);

    for (const item of pendingItems) {
      await ctx.db.patch("creditResetQueue", item._id, {
        status: "processing",
      });
    }

    return pendingItems.map((item) => ({
      queueId: item._id,
      userId: item.userId,
    }));
  },
});

/**
 * Process one claimed queue batch.
 */
export const batchResetUserCredits = internalMutation({
  args: {
    items: v.array(
      v.object({
        queueId: v.id("creditResetQueue"),
        userId: v.id("users"),
      })
    ),
    creditAmount: v.number(),
    grantType: literals("daily-grant", "monthly-grant"),
    resetTimestamp: v.number(),
  },
  returns: v.object({
    successCount: v.number(),
    failureCount: v.number(),
    failures: v.array(
      v.object({
        queueId: v.id("creditResetQueue"),
        error: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    let successCount = 0;
    const failures = args.items
      .slice(0, 0)
      .map((item) => ({ queueId: item.queueId, error: "" }));

    for (const item of args.items) {
      try {
        await resetUserCredits(ctx, {
          userId: item.userId,
          creditAmount: args.creditAmount,
          grantType: args.grantType,
          resetTimestamp: args.resetTimestamp,
        });

        await ctx.db.patch("creditResetQueue", item.queueId, {
          status: "completed",
          processedAt: Date.now(),
        });

        successCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        failures.push({ queueId: item.queueId, error: errorMessage });

        await ctx.db.patch("creditResetQueue", item.queueId, {
          status: "failed",
          error: errorMessage,
          processedAt: Date.now(),
        });
      }
    }

    return {
      successCount,
      failureCount: failures.length,
      failures,
    };
  },
});

/**
 * Mark job as completed and record completion time.
 */
export const completeResetJob = internalMutation({
  args: {
    jobId: v.id("creditResetJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("creditResetJobs", args.jobId);
    if (!job) {
      return null;
    }

    await ctx.db.patch("creditResetJobs", args.jobId, {
      status: "completed",
      completedAt: Date.now(),
      processedUsers: job.totalUsers,
    });

    logger.info("Credit reset job completed", {
      jobId: args.jobId,
      totalUsers: job.totalUsers,
      processedUsers: job.totalUsers,
    });

    return null;
  },
});

/**
 * Clean up completed and failed queue items older than retention period.
 */
export const cleanupOldQueueItems = internalMutation({
  args: {},
  returns: v.object({
    completedCount: v.number(),
    failedCount: v.number(),
  }),
  handler: async (ctx) => {
    const CUTOFF =
      Date.now() - CLEANUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000;

    // Query and delete old completed items
    const oldCompletedItems = await ctx.db
      .query("creditResetQueue")
      .withIndex("by_status", (idx) =>
        idx.eq("status", "completed").lt("_creationTime", CUTOFF)
      )
      .take(CLEANUP_CONFIG.batchSize);

    for (const item of oldCompletedItems) {
      await ctx.db.delete("creditResetQueue", item._id);
    }

    // Query and delete old failed items
    const oldFailedItems = await ctx.db
      .query("creditResetQueue")
      .withIndex("by_status", (idx) =>
        idx.eq("status", "failed").lt("_creationTime", CUTOFF)
      )
      .take(CLEANUP_CONFIG.batchSize);

    for (const item of oldFailedItems) {
      await ctx.db.delete("creditResetQueue", item._id);
    }

    logger.info("Cleaned up old queue items", {
      completedCount: oldCompletedItems.length,
      failedCount: oldFailedItems.length,
    });

    return {
      completedCount: oldCompletedItems.length,
      failedCount: oldFailedItems.length,
    };
  },
});
