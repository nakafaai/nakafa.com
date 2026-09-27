import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { readWelcomeIntentInput } from "@repo/backend/confect/emails/welcome/input";
import { enqueueRenderedWelcomeProgram } from "@repo/backend/confect/emails/welcome/internal";
import spec from "@repo/backend/confect/emails/welcome/internal.spec";
import { Effect, Layer } from "effect";

const readIntentInput = FunctionImpl.make(
  databaseSchema,
  spec,
  "readIntentInput",
  Effect.fn("emails.welcome.internal.readIntentInput")(function* ({
    intentId,
  }) {
    return yield* readWelcomeIntentInput(intentId);
  })
);
const enqueueRenderedWelcome = FunctionImpl.make(
  databaseSchema,
  spec,
  "enqueueRenderedWelcome",
  Effect.fn("emails.welcome.internal.enqueueRenderedWelcome")(function* ({
    intentId,
    ...message
  }) {
    return yield* enqueueRenderedWelcomeProgram(intentId, message);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(readIntentInput),
  Layer.provide(enqueueRenderedWelcome),
  GroupImpl.finalize
);
