import { Resend } from "@convex-dev/resend";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { components } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";

const WELCOME_TEMPLATE_ID = "welcome";
const NAKAFA_NOTIFICATION_SENDER = "Nakafa <nakafa@notifications.nakafa.com>";

/** Resend component adapter for transactional emails. */
export const resend = new Resend(components.resend, {
  testMode: false,
});

/** Sends the welcome email after a Better Auth signup creates an app user. */
export const sendWelcomeEmail = Effect.fn("notifications.sendWelcomeEmail")(
  function* (args: { email: string; name: string }) {
    const ctx = yield* MutationCtx;

    yield* Effect.promise(() =>
      resend.sendEmail(ctx, {
        from: NAKAFA_NOTIFICATION_SENDER,
        template: {
          id: WELCOME_TEMPLATE_ID,
          variables: {
            name: args.name,
          },
        },
        to: args.email,
      })
    );

    return null;
  }
);
