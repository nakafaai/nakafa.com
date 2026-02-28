import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";

/**
 * Create a reset job record.
 * Internal mutation used by actions to track reset progress.
 */
export const createResetJob = internalMutation({
  args: {
    jobType: v.union(v.literal("free-daily"), v.literal("pro-monthly")),
    resetTimestamp: v.number(),
  },
  returns: v.id("creditResetJobs"),
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("creditResetJobs", {
      jobType: args.jobType,
      status: "running",
      startedAt: Date.now(),
      resetTimestamp: args.resetTimestamp,
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
 * Idempotent credit reset for a single user.
 * Internal mutation used by workflow.
 * Safe to retry - checks if already reset.
 */
export const resetUserCredits = internalMutation({
  args: {
    userId: v.id("users"),
    creditAmount: v.number(),
    grantType: v.union(v.literal("daily-grant"), v.literal("monthly-grant")),
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
    await ctx.db.patch(args.userId, {
      credits: args.creditAmount,
      creditsResetAt: args.resetTimestamp,
    });

    // Record transaction - _creationTime is automatically set by Convex
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
 * Complete a reset job.
 * Internal mutation used by workflow.
 */
export const completeResetJob = internalMutation({
  args: {
    jobId: v.id("creditResetJobs"),
    totalProcessed: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      completedAt: Date.now(),
      processedUsers: args.totalProcessed,
    });

    logger.info("Credit reset job completed", {
      jobId: args.jobId,
      totalProcessed: args.totalProcessed,
    });

    return null;
  },
});
