import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Entry point for cron jobs to start credit reset workflow.
 */
export const populateQueue = internalAction({
  args: {
    plan: literals("free", "pro"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resetTimestamp = Date.now();
    const jobType = args.plan === "free" ? "free-daily" : "pro-monthly";

    logger.info(`Populating ${jobType} credit reset queue`, {
      plan: args.plan,
      resetTimestamp,
    });

    await workflow.start(ctx, internal.credits.workflows.orchestrateReset, {
      plan: args.plan,
      resetTimestamp,
    });

    logger.info(`${jobType} orchestration started`);

    return null;
  },
});
