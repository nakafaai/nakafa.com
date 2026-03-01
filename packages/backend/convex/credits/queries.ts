import { internalQuery } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Check if pending queue items exist for a job.
 */
export const hasPendingQueueItems = internalQuery({
  args: {
    plan: literals("free", "pro"),
    resetTimestamp: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const pendingItem = await ctx.db
      .query("creditResetQueue")
      .withIndex("planStatusTimestamp", (idx) =>
        idx
          .eq("plan", args.plan)
          .eq("status", "pending")
          .eq("resetTimestamp", args.resetTimestamp)
      )
      .first();

    return pendingItem !== null;
  },
});

/**
 * Get current job progress statistics.
 */
export const getJobProgress = internalQuery({
  args: {
    jobId: v.id("creditResetJobs"),
  },
  returns: v.object({
    totalUsers: v.number(),
    processedUsers: v.number(),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get("creditResetJobs", args.jobId);

    if (!job) {
      return { totalUsers: 0, processedUsers: 0, status: "not_found" };
    }

    return {
      totalUsers: job.totalUsers,
      processedUsers: job.processedUsers,
      status: job.status,
    };
  },
});
