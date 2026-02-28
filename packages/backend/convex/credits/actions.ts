import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/**
 * Starts the credit reset workflow for users.
 * Unified function for both free (daily) and pro (monthly) resets.
 *
 * @param isPro - false for free users (daily reset, 10 credits),
 *                true for pro users (monthly reset, 3000 credits)
 */
export const startUserReset = internalAction({
  args: {
    isPro: v.boolean(),
  },
  handler: async (ctx, args) => {
    let resetTimestamp: number;
    let jobType: "free-daily" | "pro-monthly";

    if (args.isPro) {
      // Pro: Monthly reset on 1st of month
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setUTCDate(1);
      firstDayOfMonth.setUTCHours(0, 0, 0, 0);
      resetTimestamp = firstDayOfMonth.getTime();
      jobType = "pro-monthly";
    } else {
      // Free: Daily reset
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      resetTimestamp = today.getTime();
      jobType = "free-daily";
    }

    logger.info(`Starting ${jobType} credit reset`, { resetTimestamp });

    // Create job record
    const jobId = await ctx.runMutation(
      internal.credits.mutations.createResetJob,
      {
        jobType,
        resetTimestamp,
      }
    );

    // Start workflow
    await workflow.start(ctx, internal.credits.workflows.resetCreditsBatch, {
      jobId,
      resetTimestamp,
      isPro: args.isPro,
      cursor: undefined,
      processedCount: 0,
    });

    logger.info(`${jobType} credit reset workflow started`, { jobId });

    return null;
  },
});
