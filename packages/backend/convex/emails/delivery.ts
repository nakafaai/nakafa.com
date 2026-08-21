"use node";

import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import type { WelcomeEmailInput } from "@repo/backend/convex/emails/welcome";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { renderWelcomeEmail } from "@repo/email/templates/welcome";
import { v } from "convex/values";
import { Effect } from "effect";

/** Renders one welcome message and atomically enqueues its current recipient. */
export const deliverWelcomeEmail = Effect.fn("emails.delivery.welcome")(
  function* (operations: {
    readonly enqueue: (message: {
      readonly html: string;
      readonly text: string;
    }) => Promise<unknown>;
    readonly readInput: () => Promise<WelcomeEmailInput>;
  }) {
    const input = yield* Effect.promise(operations.readInput);
    if (!input) {
      return null;
    }

    const message = yield* renderWelcomeEmail(input);
    yield* Effect.promise(() => operations.enqueue(message));
    return null;
  }
);

export const sendWelcomeEmail = internalAction({
  args: { userId: vv.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }): Promise<null> =>
    await runConvexActionProgram(
      deliverWelcomeEmail({
        enqueue: (message): Promise<unknown> =>
          ctx.runMutation(internal.emails.welcome.enqueueWelcomeEmail, {
            ...message,
            userId,
          }),
        readInput: (): Promise<WelcomeEmailInput> =>
          ctx.runQuery(internal.emails.welcome.readWelcomeEmailInput, {
            userId,
          }),
      })
    ),
});
