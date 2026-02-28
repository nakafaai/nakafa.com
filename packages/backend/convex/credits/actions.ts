import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/**
 * Populates the credit reset queue for all users of a given plan.
 * This is the entry point called by cron jobs.
 *
 * Scalable: Handles millions of users by chunking into batches
 */
export const populateQueue = internalAction({
  args: {
    plan: v.union(v.literal("free"), v.literal("pro")),
    resetTimestamp: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const jobType = args.plan === "free" ? "free-daily" : "pro-monthly";

    logger.info(`Populating ${jobType} credit reset queue`, {
      plan: args.plan,
      resetTimestamp: args.resetTimestamp,
    });

    // Start the orchestrator workflow
    await workflow.start(ctx, internal.credits.workflows.orchestrateReset, {
      plan: args.plan,
      resetTimestamp: args.resetTimestamp,
    });

    logger.info(`${jobType} orchestration started`);

    return null;
  },
});
