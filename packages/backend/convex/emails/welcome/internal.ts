import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import { resend } from "@repo/backend/convex/emails/client";
import {
  deferWelcomeIntent,
  tryWelcomeIntent,
} from "@repo/backend/convex/emails/welcome/impl";
import {
  readWelcomeIntentInput,
  welcomeIntentInputValidator,
} from "@repo/backend/convex/emails/welcome/input";
import { WELCOME_EMAIL_FROM } from "@repo/backend/convex/emails/welcome/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { Effect } from "effect";

type WelcomeIntent = Doc<"welcomeEmailIntents">;

export const readIntentInput = internalQuery({
  args: { intentId: vv.id("welcomeEmailIntents") },
  returns: welcomeIntentInputValidator,
  handler: (ctx, { intentId }) =>
    runConvexProgram(readWelcomeIntentInput(ctx, intentId)),
});

const enqueueRenderedWelcomeProgram = Effect.fn(
  "emails.welcome.enqueueRendered"
)(function* (
  ctx: MutationCtx,
  intentId: WelcomeIntent["_id"],
  message: {
    readonly html: string;
    readonly subject: string;
    readonly text: string;
  }
) {
  const intent = yield* tryWelcomeIntent(() => ctx.db.get(intentId));
  if (intent?.phase !== "scheduled") {
    return null;
  }

  const user = yield* tryWelcomeIntent(() => ctx.db.get(intent.userId));
  if (!user || user.deletedAt !== undefined) {
    yield* tryWelcomeIntent(() => ctx.db.delete(intent._id));
    return null;
  }
  if (user.deletionPreparedAt !== undefined) {
    return yield* deferWelcomeIntent();
  }

  const componentEmailId = yield* tryWelcomeIntent(() =>
    resend.sendEmail(ctx, {
      ...message,
      from: WELCOME_EMAIL_FROM,
      idempotencyKey: `welcome-email/${intent._id}`,
      to: user.email,
    })
  );
  yield* tryWelcomeIntent(() =>
    ctx.db.replace(intent._id, {
      componentEmailId,
      phase: "enqueued",
      userId: intent.userId,
      workflowId: intent.workflowId,
    })
  );
  return null;
});

/** Rechecks eligibility and checkpoints the component handle atomically. */
export const enqueueRenderedWelcome = internalMutation({
  args: {
    intentId: vv.id("welcomeEmailIntents"),
    html: v.string(),
    subject: v.string(),
    text: v.string(),
  },
  returns: v.null(),
  handler: (ctx, { intentId, ...message }) =>
    runConvexProgram(enqueueRenderedWelcomeProgram(ctx, intentId, message)),
});
