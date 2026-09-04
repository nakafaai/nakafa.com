import { vEmailId } from "@convex-dev/resend";
import { vWorkflowId } from "@convex-dev/workflow";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const commonFields = {
  userId: v.id("users"),
};

/**
 * App-owned welcome intent only. Resend owns provider delivery state, events,
 * retries, and retention inside its component tables.
 */
export const welcomeEmailIntentValidator = v.union(
  v.object({
    ...commonFields,
    phase: v.literal("awaiting-onboarding"),
  }),
  v.object({
    ...commonFields,
    locale: appLocaleValidator,
    phase: v.literal("scheduled"),
    workflowId: vWorkflowId,
  }),
  v.object({
    ...commonFields,
    componentEmailId: vEmailId,
    phase: v.literal("enqueued"),
    workflowId: v.optional(vWorkflowId),
  })
);

const tables = {
  welcomeEmailIntents: defineTable(welcomeEmailIntentValidator)
    .index("by_userId", ["userId"])
    .index("by_phase", ["phase"]),
};

export default tables;
