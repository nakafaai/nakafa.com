import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  MutationCtx as MutationCtxService,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
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
    const ctx = yield* QueryCtxService;
    return yield* readWelcomeIntentInput(ctx, intentId);
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
    const ctx = yield* MutationCtxService;
    return yield* enqueueRenderedWelcomeProgram(ctx, intentId, message);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(readIntentInput),
  Layer.provide(enqueueRenderedWelcome),
  GroupImpl.finalize
);
