import { components } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

/**
 * Applies the Resend component's bounded retention policy.
 *
 * The component owns both retention windows so Nakafa does not duplicate
 * processor-specific durations. This app does not use historical delivery
 * records after an email has been sent.
 */
export const cleanupRetainedEmailData = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, components.resend.lib.cleanupOldEmails, {});
    await ctx.scheduler.runAfter(
      0,
      components.resend.lib.cleanupAbandonedEmails,
      {}
    );

    return null;
  },
});
