import { CLEANUP_CONFIG } from "@repo/backend/convex/credits/constants";
import { resetUserCredits } from "@repo/backend/convex/credits/utils";
import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Create a credit reset job record to track progress.
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
    batchSize: v.number(),
  },
  returns: v.object({
    usersAdded: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Query users who need credit reset using index
    // Note: We don't use cursor pagination because:
    // 1. The idempotency check in resetUserCreditsHelper prevents duplicates
    // 2. Once added to queue, users are filtered by status in claimQueueItems
    // 3. This avoids needing complex multi-field index ranges
    const users = await ctx.db
      .query("users")
      .withIndex("plan", (idx) =>
        idx.eq("plan", args.plan).lt("creditsResetAt", args.resetTimestamp)
      )
      .take(args.batchSize);

    if (users.length === 0) {
      return { usersAdded: 0, hasMore: false };
    }

    for (const user of users) {
      await ctx.db.insert("creditResetQueue", {
        userId: user._id,
        plan: args.plan,
        resetTimestamp: args.resetTimestamp,
        status: "pending",
      });
    }

    logger.info("Queue batch populated", {
      jobId: args.jobId,
      plan: args.plan,
      batchSize: users.length,
    });

    return {
      usersAdded: users.length,
      hasMore: users.length >= args.batchSize,
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
    batchSize: v.number(),
  },
  returns: v.array(
    v.object({
      queueId: v.id("creditResetQueue"),
      userId: v.id("users"),
      credits: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const pendingItems = await ctx.db
      .query("creditResetQueue")
      .withIndex("planStatusTimestamp", (idx) =>
        idx
          .eq("plan", args.plan)
          .eq("status", "pending")
          .eq("resetTimestamp", args.resetTimestamp)
      )
      .take(args.batchSize);

    const claimed = await Promise.all(
      pendingItems.map(async (item) => {
        // Check user exists BEFORE marking as processing
        // This prevents deleted users from getting stuck in 'processing' status
        const user = await ctx.db.get("users", item.userId);

        if (!user) {
          // User deleted - mark as completed so it's not stuck
          await ctx.db.patch("creditResetQueue", item._id, {
            status: "completed",
            processedAt: Date.now(),
          });
          return null;
        }

        // Only mark as processing if user exists
        await ctx.db.patch("creditResetQueue", item._id, {
          status: "processing",
        });

        return {
          queueId: item._id,
          userId: item.userId,
          credits: user.credits,
        };
      })
    );

    return claimed.filter((item) => item !== null);
  },
});

/**
 * Batch process credit resets for multiple users in parallel.
 */
export const batchResetUserCredits = internalMutation({
  args: {
    items: v.array(
      v.object({
        queueId: v.id("creditResetQueue"),
        userId: v.id("users"),
        previousBalance: v.number(),
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
    const results = await Promise.all(
      args.items.map(async (item) => {
        try {
          await resetUserCredits(ctx, {
            userId: item.userId,
            creditAmount: args.creditAmount,
            grantType: args.grantType,
            resetTimestamp: args.resetTimestamp,
            previousBalance: item.previousBalance,
          });
          return { queueId: item.queueId, success: true as const };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            queueId: item.queueId,
            success: false as const,
            error: errorMessage,
          };
        }
      })
    );

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    if (successes.length > 0) {
      for (const success of successes) {
        await ctx.db.patch("creditResetQueue", success.queueId, {
          status: "completed",
          processedAt: Date.now(),
        });
      }
    }

    if (failures.length > 0) {
      for (const failure of failures) {
        await ctx.db.patch("creditResetQueue", failure.queueId, {
          status: "failed",
          error: failure.error,
          processedAt: Date.now(),
        });
      }
    }

    return {
      successCount: successes.length,
      failureCount: failures.length,
      failures: failures.map((f) => ({ queueId: f.queueId, error: f.error })),
    };
  },
});

/**
 * Increment job progress counter atomically.
 */
export const incrementJobProgress = internalMutation({
  args: {
    jobId: v.id("creditResetJobs"),
    increment: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("creditResetJobs", args.jobId);
    if (!job) {
      return null;
    }

    await ctx.db.patch("creditResetJobs", args.jobId, {
      processedUsers: job.processedUsers + args.increment,
    });

    return null;
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
    });

    logger.info("Credit reset job completed", {
      jobId: args.jobId,
      totalUsers: job.totalUsers,
      processedUsers: job.processedUsers,
    });

    return null;
  },
});

/**
 * Clean up completed queue items older than retention period.
 */
export const cleanupOldQueueItems = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const CUTOFF =
      Date.now() - CLEANUP_CONFIG.retentionDays * 24 * 60 * 60 * 1000;

    const oldItems = await ctx.db
      .query("creditResetQueue")
      .withIndex("status", (idx) =>
        idx.eq("status", "completed").lt("_creationTime", CUTOFF)
      )
      .take(CLEANUP_CONFIG.batchSize);

    for (const item of oldItems) {
      await ctx.db.delete("creditResetQueue", item._id);
    }

    logger.info("Cleaned up old queue items", {
      count: oldItems.length,
    });

    return oldItems.length;
  },
});
