import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
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

/**
 * Deduct credits for AI usage.
 * Public mutation - called when user uses AI.
 * Validates sufficient balance before deducting.
 */
export const deductCredits = mutation({
  args: {
    amount: v.number(),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.object({
    success: v.boolean(),
    remaining: v.number(),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);

    const currentCredits = appUser.credits ?? 0;

    if (currentCredits < args.amount) {
      return { success: false, remaining: currentCredits };
    }

    const newBalance = currentCredits - args.amount;

    // Update user
    await ctx.db.patch(appUser._id, {
      credits: newBalance,
    });

    // Record transaction - _creationTime is automatically set by Convex
    await ctx.db.insert("creditTransactions", {
      userId: appUser._id,
      amount: -args.amount,
      type: "usage",
      balanceAfter: newBalance,
      metadata: args.metadata,
    });

    return { success: true, remaining: newBalance };
  },
});

/**
 * Add credits (for purchases, bonuses, refunds).
 * Admin-only or internal use.
 */
export const addCredits = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    type: v.union(
      v.literal("purchase"),
      v.literal("refund"),
      v.literal("bonus")
    ),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      throw new Error("User not found");
    }

    const currentCredits = user.credits ?? 0;
    const newBalance = currentCredits + args.amount;

    // Update user
    await ctx.db.patch(args.userId, {
      credits: newBalance,
    });

    // Record transaction - _creationTime is automatically set by Convex
    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      amount: args.amount,
      type: args.type,
      balanceAfter: newBalance,
      metadata: args.metadata,
    });

    logger.info("Credits added", {
      userId: args.userId,
      amount: args.amount,
      type: args.type,
      newBalance,
    });

    return null;
  },
});
