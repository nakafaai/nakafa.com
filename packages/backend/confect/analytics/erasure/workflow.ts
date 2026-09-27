import { ANALYTICS_ERASURE_RETRY } from "@repo/backend/confect/analytics/erasure/policy";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import { v } from "convex/values";

/** Durably erases an analytics write proven to overlap consent withdrawal. */
export const eraseConsentOverlap = workflow.define({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    await step.runAction(
      internal.analytics.erasure.action.eraseUserAnalytics,
      { userId: args.userId },
      { retry: ANALYTICS_ERASURE_RETRY }
    );

    return null;
  },
});
