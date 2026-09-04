"use node";

import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { tryWelcomeIntent } from "@repo/backend/convex/emails/welcome/impl";
import type { WelcomeIntentInput } from "@repo/backend/convex/emails/welcome/input";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { renderAccountReadyEmail } from "@repo/email/templates/account-ready";
import { v } from "convex/values";
import { Effect } from "effect";

const deliverWelcomeEmailProgram = Effect.fn("emails.welcome.deliver")(
  function* (
    readInput: () => Promise<WelcomeIntentInput>,
    enqueue: (message: {
      readonly html: string;
      readonly subject: string;
      readonly text: string;
    }) => Promise<null>
  ) {
    const input = yield* tryWelcomeIntent(readInput);
    if (!input) {
      return null;
    }

    const message = yield* renderAccountReadyEmail({
      continueUrl: input.continueUrl,
      locale: input.locale,
      privacyPolicyUrl: input.privacyPolicyUrl,
      termsOfServiceUrl: input.termsOfServiceUrl,
    });
    yield* tryWelcomeIntent(() => enqueue(message));
    return null;
  }
);

/** Renders and idempotently enqueues one activated welcome intent. */
export const sendWelcomeEmail = internalAction({
  args: { intentId: vv.id("welcomeEmailIntents") },
  returns: v.null(),
  handler: async (ctx, { intentId }): Promise<null> =>
    await runConvexActionProgram(
      deliverWelcomeEmailProgram(
        (): Promise<WelcomeIntentInput> =>
          ctx.runQuery(internal.emails.welcome.internal.readIntentInput, {
            intentId,
          }),
        (message) =>
          ctx.runMutation(
            internal.emails.welcome.internal.enqueueRenderedWelcome,
            { intentId, ...message }
          )
      )
    ),
});
