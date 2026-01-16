import { Resend } from "@convex-dev/resend";
import { components } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";

export const resend: Resend = new Resend(components.resend, {
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
