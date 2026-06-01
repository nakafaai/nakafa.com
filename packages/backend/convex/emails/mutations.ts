import { Resend } from "@convex-dev/resend";
import { components } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
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
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await resend.sendEmail(ctx, {
      from: "Nakafa <nakafa@notifications.nakafa.com>",
      to: args.email,
      template: {
        id: "welcome",
        variables: {
          name: args.name,
        },
      },
    });
  },
});
