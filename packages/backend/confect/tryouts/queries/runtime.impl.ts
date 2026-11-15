import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { readWorkingLanguage } from "@repo/backend/confect/tryouts/language";
import spec from "@repo/backend/confect/tryouts/queries/runtime.spec";
import { readSectionAttemptState } from "@repo/backend/confect/tryouts/runtime/section/state";
import { readSetAttemptState } from "@repo/backend/confect/tryouts/runtime/set/state";
import { Effect, Layer, Option } from "effect";

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
/** Reads the language the caller last chose for one exam's questions, which a section page preselects. */
const getWorkingLanguage = FunctionImpl.make(
  databaseSchema,
  spec,
  "getWorkingLanguage",
  Effect.fn("tryouts.queries.runtime.getWorkingLanguage")(function* (args) {
    const { appUser } = yield* requireAuth();
    return Option.getOrNull(yield* readWorkingLanguage(appUser._id, args));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getWorkingLanguage),
  Layer.provide(getSetAttemptState),
  Layer.provide(getSectionAttemptState),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
