import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Create a reset job record.
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
 * Populate the queue with all users needing credit reset.
 * Processes users in batches to handle millions efficiently.
 */
export const populateQueue = internalMutation({
  args: {
    plan: literals("free", "pro"),
    resetTimestamp: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let totalUsers = 0;
    const BATCH_SIZE = 1000;

    // Process users in batches
    while (true) {
      const users = await ctx.db
        .query("users")
        .withIndex("plan", (idx) =>
          idx.eq("plan", args.plan).lt("creditsResetAt", args.resetTimestamp)
        )
        .take(BATCH_SIZE);

      if (users.length === 0) {
        break;
      }

      // Add users to queue
      for (const user of users) {
        await ctx.db.insert("creditResetQueue", {
          userId: user._id,
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          status: "pending",
        });
      }

      totalUsers += users.length;

      logger.info("Queue populated batch", {
        plan: args.plan,
        batchSize: users.length,
        totalSoFar: totalUsers,
      });

      // Continue if we got a full batch
      if (users.length < BATCH_SIZE) {
        break;
      }
    }

    logger.info("Queue population complete", {
      plan: args.plan,
      totalUsers,
    });

    return totalUsers;
  },
});

/**
 * Claim pending queue items for processing.
 * Workers call this to get work.
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
    // Find pending items using indexed query (no .filter())
    const pendingItems = await ctx.db
      .query("creditResetQueue")
      .withIndex("planStatusTimestamp", (idx) =>
        idx
          .eq("plan", args.plan)
          .eq("status", "pending")
          .eq("resetTimestamp", args.resetTimestamp)
      )
      .take(args.batchSize);

    if (pendingItems.length === 0) {
      return [];
    }

    // Claim them by setting status to processing and collect results
    const claimed = await Promise.all(
      pendingItems.map(async (item) => {
        await ctx.db.patch("creditResetQueue", item._id, {
          status: "processing",
        });

        // Get user credits
        const user = await ctx.db.get("users", item.userId);

        return user
          ? {
              queueId: item._id,
              userId: item.userId,
              credits: user.credits,
            }
          : null;
      })
    );

    return claimed.filter((item) => item !== null);
  },
});

/**
 * Mark queue items as completed.
 */
export const completeQueueItems = internalMutation({
  args: {
    queueIds: v.array(v.id("creditResetQueue")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const queueId of args.queueIds) {
      await ctx.db.patch("creditResetQueue", queueId, {
        status: "completed",
        processedAt: Date.now(),
      });
    }
    return null;
  },
});

/**
 * Reset user credits and record transaction.
 */
export const resetUserCredits = internalMutation({
  args: {
    userId: v.id("users"),
    creditAmount: v.number(),
    grantType: literals("daily-grant", "monthly-grant"),
    resetTimestamp: v.number(),
    previousBalance: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      logger.warn("User not found during credit reset", {
        userId: args.userId,
      });
      return null;
    }

    // Idempotency check: already reset?
    if (user.creditsResetAt && user.creditsResetAt >= args.resetTimestamp) {
      logger.info("User credits already reset, skipping", {
        userId: args.userId,
        creditsResetAt: user.creditsResetAt,
        resetTimestamp: args.resetTimestamp,
      });
      return null;
    }

    // Update user credits
    await ctx.db.patch("users", args.userId, {
      credits: args.creditAmount,
      creditsResetAt: args.resetTimestamp,
    });

    // Record transaction
    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      amount: args.creditAmount,
      type: args.grantType,
      balanceAfter: args.creditAmount,
      metadata: {
        previousBalance: args.previousBalance,
      },
    });

    logger.info("User credits reset", {
      userId: args.userId,
      amount: args.creditAmount,
      type: args.grantType,
    });

    return null;
  },
});

/**
 * Update job progress.
 */
export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("creditResetJobs"),
    processedCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("creditResetJobs", args.jobId, {
      processedUsers: args.processedCount,
    });
    return null;
  },
});

/**
 * Complete a reset job.
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
      totalProcessed: job.processedUsers,
    });

    return null;
  },
});

/**
 * Clean up completed queue items older than 7 days.
 * Called periodically to prevent unbounded growth.
 */
export const cleanupOldQueueItems = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const CUTOFF = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
    let deletedCount = 0;

    const oldItems = await ctx.db
      .query("creditResetQueue")
      .withIndex("status", (idx) =>
        idx.eq("status", "completed").lt("_creationTime", CUTOFF)
      )
      .take(1000);

    for (const item of oldItems) {
      await ctx.db.delete("creditResetQueue", item._id);
      deletedCount++;
    }

    return deletedCount;
  },
});
