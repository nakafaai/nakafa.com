import {
  FunctionImpl,
  GroupImpl,
  MutationRunner,
  QueryRunner,
} from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { deliverWelcomeEmailProgram } from "@repo/backend/confect/emails/welcome/delivery";
import spec from "@repo/backend/confect/emails/welcome/delivery.spec";
import { toWelcomeIntentError } from "@repo/backend/confect/emails/welcome/impl";
import { Effect, flow, Layer } from "effect";

const sendWelcomeEmail = FunctionImpl.make(
  databaseSchema,
  spec,
  "sendWelcomeEmail",
  Effect.fn("emails.welcome.delivery.sendWelcomeEmail")(function* ({
    intentId,
  }) {
    const runQuery = yield* QueryRunner.QueryRunner;
    const runMutation = yield* MutationRunner.MutationRunner;
    return yield* deliverWelcomeEmailProgram(
      runQuery(refs.internal.emails.welcome.internal.readIntentInput, {
        intentId,
      }).pipe(
        Effect.mapError(toWelcomeIntentError),
        Effect.catchDefect(flow(toWelcomeIntentError, Effect.fail))
      ),
      (message) =>
        runMutation(
          refs.internal.emails.welcome.internal.enqueueRenderedWelcome,
          {
            intentId,
            ...message,
          }
        ).pipe(
          Effect.mapError(toWelcomeIntentError),
          Effect.catchDefect(flow(toWelcomeIntentError, Effect.fail))
        )
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(sendWelcomeEmail),
  GroupImpl.finalize
);
