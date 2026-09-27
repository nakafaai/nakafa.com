import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/tryouts/queries/runtime.spec";
import { readSectionAttemptState } from "@repo/backend/confect/tryouts/runtime/section/state";
import { readSetAttemptState } from "@repo/backend/confect/tryouts/runtime/set/state";
import { Effect, Layer } from "effect";

const getSetAttemptState = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSetAttemptState",
  Effect.fn("tryouts.queries.runtime.getSetAttemptState")(function* (args) {
    return yield* readSetAttemptState(args);
  })
);
const getSectionAttemptState = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSectionAttemptState",
  Effect.fn("tryouts.queries.runtime.getSectionAttemptState")(function* (args) {
    return yield* readSectionAttemptState(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getSetAttemptState),
  Layer.provide(getSectionAttemptState),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
