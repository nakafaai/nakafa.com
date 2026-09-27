import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { resend } from "@repo/backend/confect/emails/client";
import {
  deferWelcomeIntent,
  toWelcomeIntentError,
  tryWelcomeIntent,
} from "@repo/backend/confect/emails/welcome/impl";
import { WELCOME_EMAIL_FROM } from "@repo/backend/confect/emails/welcome/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, flow } from "effect";
export type WelcomeIntent = Doc<"welcomeEmailIntents">;
export const enqueueRenderedWelcomeProgram = Effect.fn(
  "emails.welcome.enqueueRendered"
)(
  function* (
    ctx: MutationCtx,
    intentId: WelcomeIntent["_id"],
    message: {
      readonly html: string;
      readonly subject: string;
      readonly text: string;
    }
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const intent = yield* database
      .table("welcomeEmailIntents")
      .get(intentId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (intent?.phase !== "scheduled") {
      return null;
    }
    const user = yield* database
      .table("users")
      .get(intent.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!user || user.deletedAt !== undefined) {
      yield* writer.table("welcomeEmailIntents").delete(intent._id);
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
    yield* writer
      .table("welcomeEmailIntents")
      .replace(intent._id, {
        componentEmailId,
        phase: "enqueued",
        userId: intent.userId,
        workflowId: intent.workflowId,
      })
      .pipe(Effect.orDie);
    return null;
  },
  Effect.catchDefect(flow(toWelcomeIntentError, Effect.fail))
);
