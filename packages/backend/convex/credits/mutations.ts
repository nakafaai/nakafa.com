import { internal } from "@repo/backend/convex/_generated/api";
import {
  CREDIT_RESET_BATCH_SIZE,
  CREDIT_RESET_STALE_MS,
  getPlanCreditConfig,
} from "@repo/backend/convex/credits/constants";
import { creditTransactionTypeValidator } from "@repo/backend/convex/credits/schema";
import { internalMutation } from "@repo/backend/convex/functions";
import { userPlanValidator } from "@repo/backend/convex/users/schema";
import { userWriteWorkpool } from "@repo/backend/convex/users/workpool";
import { logger } from "@repo/backend/convex/utils/logger";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Applies one serialized credit balance change and writes the matching ledger row. */
export const applyCreditBalanceEvent = internalMutation({
  args: {
    amount: v.number(),
    eventType: literals("plan-change", "reset-grant", "usage"),
    metadata: v.optional(v.record(v.string(), v.any())),
    plan: v.optional(userPlanValidator),
    resetTimestamp: v.optional(v.number()),
    transactionType: v.optional(creditTransactionTypeValidator),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      logger.warn("Skipping credit balance event for missing user", {
        eventType: args.eventType,
        userId: args.userId,
      });
      return null;
    }

    if (args.eventType === "usage") {
      const newBalance = user.credits - args.amount;

      await ctx.db.patch("users", args.userId, {
        credits: newBalance,
      });

      await ctx.db.insert("creditTransactions", {
        userId: args.userId,
        amount: -args.amount,
        type: "usage",
        balanceAfter: newBalance,
        metadata: args.metadata,
      });

      return null;
    }

    if (args.eventType === "reset-grant") {
      if (args.resetTimestamp === undefined) {
        throw new ConvexError({
          code: "CREDIT_RESET_TIMESTAMP_MISSING",
          message: "Credit reset events require a reset timestamp.",
        });
      }

      if (user.creditsResetAt >= args.resetTimestamp) {
        return null;
      }

      const previousBalance = user.credits;
      const debtAdjustment = previousBalance < 0 ? previousBalance : 0;
      const newBalance = args.amount + debtAdjustment;

      await ctx.db.patch("users", args.userId, {
        credits: newBalance,
        creditsResetAt: args.resetTimestamp,
      });

      await ctx.db.insert("creditTransactions", {
        userId: args.userId,
        amount: args.amount,
        type: args.transactionType ?? "daily-grant",
        balanceAfter: newBalance,
        metadata: {
          ...args.metadata,
          baseGrant: args.amount,
          debtAdjustment,
          previousBalance,
        },
      });

      return null;
    }

    if (!args.plan) {
      throw new ConvexError({
        code: "CREDIT_PLAN_MISSING",
        message: "Plan-change events require a plan.",
      });
    }

    const nextCredits =
      args.resetTimestamp === undefined ? user.credits : args.amount;
    const nextUserPatch = {
      plan: args.plan,
      credits: nextCredits,
      creditsResetAt: args.resetTimestamp ?? user.creditsResetAt,
    };

    if (
      user.plan === nextUserPatch.plan &&
      user.credits === nextUserPatch.credits &&
      user.creditsResetAt === nextUserPatch.creditsResetAt
    ) {
      return null;
    }

    await ctx.db.patch("users", args.userId, nextUserPatch);

    if (!args.transactionType) {
      return null;
    }

    await ctx.db.insert("creditTransactions", {
      userId: args.userId,
      amount: args.amount,
      type: args.transactionType,
      balanceAfter: nextCredits,
      metadata: args.metadata,
    });

    return null;
  },
});

/** Starts one credit reset job per plan and schedules its first batch. */
export const startCreditReset = internalMutation({
  args: {
    plan: literals("free", "pro"),
  },
  returns: v.object({
    scheduled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const resetTimestamp = Date.now();
    const creditConfig = getPlanCreditConfig(args.plan);
    const resetDate = new Date(resetTimestamp);
    const latestJob = await ctx.db
      .query("creditResetJobs")
      .withIndex("by_jobType_and_startedAt", (q) =>
        q.eq("jobType", creditConfig.jobType)
      )
      .order("desc")
      .first();

    if (latestJob?.status === "running") {
      const jobIsStale =
        resetTimestamp - latestJob.startedAt > CREDIT_RESET_STALE_MS;

      if (!jobIsStale) {
        logger.info("Credit reset already running, skipping duplicate start", {
          jobId: latestJob._id,
          jobType: creditConfig.jobType,
        });

        return { scheduled: false };
      }

      await ctx.db.patch("creditResetJobs", latestJob._id, {
        completedAt: resetTimestamp,
        error: "Marked failed because the running job became stale.",
        status: "failed",
      });
    }

    if (latestJob?.status === "completed") {
      const latestJobDate = new Date(latestJob.startedAt);
      const completedThisPeriod =
        args.plan === "free"
          ? latestJobDate.getUTCFullYear() === resetDate.getUTCFullYear() &&
            latestJobDate.getUTCMonth() === resetDate.getUTCMonth() &&
            latestJobDate.getUTCDate() === resetDate.getUTCDate()
          : latestJobDate.getUTCFullYear() === resetDate.getUTCFullYear() &&
            latestJobDate.getUTCMonth() === resetDate.getUTCMonth();

      if (completedThisPeriod) {
        logger.info("Credit reset already completed in the current period", {
          jobId: latestJob._id,
          jobType: creditConfig.jobType,
        });

        return { scheduled: false };
      }
    }

    const jobId = await ctx.db.insert("creditResetJobs", {
      jobType: creditConfig.jobType,
      status: "running",
      startedAt: resetTimestamp,
      resetTimestamp,
      totalUsers: 0,
      processedUsers: 0,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.credits.mutations.processCreditResetBatch,
      {
        jobId,
        paginationOpts: {
          cursor: null,
          numItems: CREDIT_RESET_BATCH_SIZE,
        },
        plan: args.plan,
        resetTimestamp,
      }
    );

    logger.info("Credit reset job started", {
      jobId,
      jobType: creditConfig.jobType,
      resetTimestamp,
    });

    return { scheduled: true };
  },
});

/** Resets one bounded batch of users and schedules the next batch if needed. */
export const processCreditResetBatch = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
    jobId: v.id("creditResetJobs"),
    plan: literals("free", "pro"),
    resetTimestamp: v.number(),
  },
  returns: v.object({
    processedUsers: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("creditResetJobs", args.jobId);

    if (!job) {
      return {
        processedUsers: 0,
        isDone: true,
      };
    }

    if (job.status !== "running") {
      return {
        processedUsers: 0,
        isDone: true,
      };
    }

    if (job.resetTimestamp !== args.resetTimestamp) {
      return {
        processedUsers: 0,
        isDone: true,
      };
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_plan_and_creditsResetAt", (idx) =>
        idx.eq("plan", args.plan).lt("creditsResetAt", args.resetTimestamp)
      )
      .paginate(args.paginationOpts);

    if (users.page.length === 0) {
      await ctx.db.patch("creditResetJobs", args.jobId, {
        completedAt: Date.now(),
        status: "completed",
        totalUsers: job.processedUsers,
      });

      logger.info("Credit reset job completed", {
        jobId: args.jobId,
        processedUsers: job.processedUsers,
      });

      return {
        processedUsers: 0,
        isDone: true,
      };
    }

    const creditConfig = getPlanCreditConfig(args.plan);

    try {
      await userWriteWorkpool.enqueueMutationBatch(
        ctx,
        internal.credits.mutations.applyCreditBalanceEvent,
        users.page.map((user) => ({
          amount: creditConfig.amount,
          eventType: "reset-grant" as const,
          resetTimestamp: args.resetTimestamp,
          transactionType: creditConfig.grantType,
          userId: user._id,
        }))
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await ctx.db.patch("creditResetJobs", args.jobId, {
        completedAt: Date.now(),
        error: errorMessage,
        status: "failed",
      });

      logger.error("Credit reset batch failed", {
        error: errorMessage,
        jobId: args.jobId,
        plan: args.plan,
      });

      return {
        processedUsers: 0,
        isDone: true,
      };
    }

    const processedUsers = job.processedUsers + users.page.length;

    const isDone = users.isDone;

    if (isDone) {
      await ctx.db.patch("creditResetJobs", args.jobId, {
        completedAt: Date.now(),
        processedUsers,
        status: "completed",
        totalUsers: processedUsers,
      });
    } else {
      await ctx.db.patch("creditResetJobs", args.jobId, {
        processedUsers,
        totalUsers: processedUsers,
      });
    }

    if (!isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.credits.mutations.processCreditResetBatch,
        {
          ...args,
          paginationOpts: {
            cursor: users.continueCursor,
            numItems: CREDIT_RESET_BATCH_SIZE,
          },
        }
      );
    }

    logger.info("Credit reset batch processed", {
      jobId: args.jobId,
      isDone,
      plan: args.plan,
      processedBatchSize: users.page.length,
      processedUsers,
    });

    return {
      processedUsers: users.page.length,
      isDone,
    };
  },
});
