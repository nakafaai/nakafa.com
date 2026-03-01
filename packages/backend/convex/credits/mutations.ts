import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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
 * Mark queue items as failed with individual error messages.
 */
export const failQueueItems = internalMutation({
  args: {
    failures: v.array(
      v.object({
        queueId: v.id("creditResetQueue"),
        error: v.string(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const failure of args.failures) {
      await ctx.db.patch("creditResetQueue", failure.queueId, {
        status: "failed",
        error: failure.error,
        processedAt: Date.now(),
      });
    }
    return null;
  },
});

/**
 * Batch reset user credits - Convex best practice.
 *
 * WHY THIS APPROACH:
 * - Workflows have 8MiB journal limit; each step is recorded
 * - Processing 100 items sequentially = 100+ workflow steps
 * - This approach: 1 workflow step calling 1 mutation
 * - Mutation processes all 100 items in parallel internally
 * - Still maintains per-item error tracking
 * - Follows "batch operations in mutations" best practice
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
    // Process all items in parallel inside the mutation
    // This is more efficient than sequential workflow steps
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

    // Mark successful items as completed
    if (successes.length > 0) {
      for (const success of successes) {
        await ctx.db.patch("creditResetQueue", success.queueId, {
          status: "completed",
          processedAt: Date.now(),
        });
      }
    }

    // Mark failed items with their specific errors
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
 * Helper function to reset a single user's credits.
 * Extracted for reuse and clarity.
 */
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

  // Idempotency check: already reset?
  if (user.creditsResetAt && user.creditsResetAt >= args.resetTimestamp) {
    logger.info("User credits already reset, skipping", {
      userId: args.userId,
      creditsResetAt: user.creditsResetAt,
      resetTimestamp: args.resetTimestamp,
    });
    return;
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
}

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
 * Increment job progress by a delta.
 * Used by workers to report progress atomically.
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
