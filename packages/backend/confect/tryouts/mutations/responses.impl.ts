import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { tryoutGate } from "@repo/backend/confect/tryouts/gate";
import spec from "@repo/backend/confect/tryouts/mutations/responses.spec";
import { Effect, Layer } from "effect";

/** Saves one answer of the caller's running section through the live-attempt gate. */
const save = FunctionImpl.make(
  databaseSchema,
  spec,
  "save",
  Effect.fn("tryouts.mutations.responses.save")(function* (args) {
    const { appUser } = yield* requireAuth();
    yield* tryoutGate.answer(appUser._id, args);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(save),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
