import { Resend } from "@convex-dev/resend";
import { components } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Resend component boundary.
 *
 * This intentionally uses Convex's raw internalMutation because it writes only
 * through the Resend component, not app tables registered in convex/functions.ts.
 * Importing the trigger-aware builder here would load the app trigger graph for
 * an email enqueue function without adding trigger coverage.
 *
 * @see https://www.convex.dev/components/resend
 */
export const resend = new Resend(components.resend, {
  testMode: false,
});

export const sendWelcomeEmail = internalMutation({
  args: {
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user || isAccountDeletionPending(user)) {
      return null;
    }

    await resend.sendEmail(ctx, {
      from: "Nakafa <nakafa@notifications.nakafa.com>",
      to: user.email,
      template: {
        id: "welcome",
        variables: {
          name: user.name,
        },
      },
    });

    return null;
  },
});

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
