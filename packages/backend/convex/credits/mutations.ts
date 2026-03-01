import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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
 * Populate queue with users needing credit reset and update job total.
 */
export const populateQueue = internalMutation({
  args: {
    jobId: v.id("creditResetJobs"),
    plan: literals("free", "pro"),
    resetTimestamp: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let totalUsers = 0;
    const BATCH_SIZE = 1000;
    let lastId: string | undefined;

    while (true) {
      let query = ctx.db
        .query("users")
        .withIndex("plan", (idx) =>
          idx.eq("plan", args.plan).lt("creditsResetAt", args.resetTimestamp)
        );

      const cursorId = lastId;
      if (cursorId) {
        query = query.filter((q) => q.gt(q.field("_id"), cursorId));
      }

      const users = await query.take(BATCH_SIZE);

      if (users.length === 0) {
        break;
      }

      for (const user of users) {
        await ctx.db.insert("creditResetQueue", {
          userId: user._id,
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          status: "pending",
        });
      }

      totalUsers += users.length;
      lastId = users.at(-1)?._id;

      logger.info("Queue populated batch", {
        plan: args.plan,
        batchSize: users.length,
        totalSoFar: totalUsers,
      });

      if (users.length < BATCH_SIZE) {
        break;
      }
    }

    // Update job record with total users count
    // This is done in the same mutation to ensure atomicity
    // and minimize workflow steps (Convex best practice)
    await ctx.db.patch("creditResetJobs", args.jobId, {
      totalUsers,
    });

    logger.info("Queue population complete", {
      jobId: args.jobId,
      plan: args.plan,
      totalUsers,
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
          await resetUserCreditsHelper(ctx, {
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

async function resetUserCreditsHelper(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    creditAmount: number;
    grantType: "daily-grant" | "monthly-grant";
    resetTimestamp: number;
    previousBalance: number;
  }
) {
  const user = await ctx.db.get("users", args.userId);

  if (!user) {
    throw new Error(`User not found: ${args.userId}`);
  }

  if (user.creditsResetAt && user.creditsResetAt >= args.resetTimestamp) {
    logger.info("User credits already reset, skipping", {
      userId: args.userId,
      creditsResetAt: user.creditsResetAt,
      resetTimestamp: args.resetTimestamp,
    });
    return;
  }

  await ctx.db.patch("users", args.userId, {
    credits: args.creditAmount,
    creditsResetAt: args.resetTimestamp,
  });

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
}

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
 * Clean up completed queue items older than 7 days.
 */
export const cleanupOldQueueItems = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const CUTOFF = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const oldItems = await ctx.db
      .query("creditResetQueue")
      .withIndex("status", (idx) =>
        idx.eq("status", "completed").lt("_creationTime", CUTOFF)
      )
      .take(1000);

    for (const item of oldItems) {
      await ctx.db.delete("creditResetQueue", item._id);
    }

    logger.info("Cleaned up old queue items", {
      count: oldItems.length,
    });

    return oldItems.length;
  },
});
