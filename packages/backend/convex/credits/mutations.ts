import { internal } from "@repo/backend/convex/_generated/api";
import {
  CREDIT_RESET_BATCH_SIZE,
  CREDIT_RESET_STALE_MS,
  getPlanCreditConfig,
} from "@repo/backend/convex/credits/constants";
import { resetUserCredits } from "@repo/backend/convex/credits/utils";
import { internalMutation } from "@repo/backend/convex/functions";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

function isSameResetPeriod(
  plan: "free" | "pro",
  leftAt: number,
  rightAt: number
) {
  const left = new Date(leftAt);
  const right = new Date(rightAt);

  if (plan === "free") {
    return (
      left.getUTCFullYear() === right.getUTCFullYear() &&
      left.getUTCMonth() === right.getUTCMonth() &&
      left.getUTCDate() === right.getUTCDate()
    );
  }

  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth()
  );
}

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

    if (
      latestJob?.status === "completed" &&
      isSameResetPeriod(args.plan, latestJob.startedAt, resetTimestamp)
    ) {
      logger.info("Credit reset already completed in the current period", {
        jobId: latestJob._id,
        jobType: creditConfig.jobType,
      });

      return { scheduled: false };
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
      .take(CREDIT_RESET_BATCH_SIZE);

    if (users.length === 0) {
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

    for (const user of users) {
      await resetUserCredits(ctx, {
        userId: user._id,
        creditAmount: creditConfig.amount,
        grantType: creditConfig.grantType,
        resetTimestamp: args.resetTimestamp,
      });
    }

    const processedUsers = job.processedUsers + users.length;

    await ctx.db.patch("creditResetJobs", args.jobId, {
      processedUsers,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.credits.mutations.processCreditResetBatch,
      args
    );

    logger.info("Credit reset batch processed", {
      jobId: args.jobId,
      plan: args.plan,
      processedBatchSize: users.length,
      processedUsers,
    });

    return {
      processedUsers: users.length,
      isDone: false,
    };
  },
});
