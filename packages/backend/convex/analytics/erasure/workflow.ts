import { internal } from "@repo/backend/convex/_generated/api";
import { ANALYTICS_ERASURE_RETRY } from "@repo/backend/convex/analytics/erasure/policy";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/** Durably erases an analytics write proven to overlap consent withdrawal. */
export const eraseConsentOverlap = workflow.define({
  args: {
    userId: vv.id("users"),
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
