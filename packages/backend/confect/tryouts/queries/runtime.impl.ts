import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/tryouts/queries/runtime.spec";
import { readSectionAttemptState } from "@repo/backend/confect/tryouts/runtime/section/state";
import { readSetAttemptState } from "@repo/backend/confect/tryouts/runtime/set/state";
import { Effect, Layer } from "effect";

const getSetAttemptState = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSetAttemptState",
  Effect.fn("tryouts.queries.runtime.getSetAttemptState")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readSetAttemptState(ctx, args.attemptId);
  })
);
const getSectionAttemptState = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSectionAttemptState",
  Effect.fn("tryouts.queries.runtime.getSectionAttemptState")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readSectionAttemptState(ctx, args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getSetAttemptState),
  Layer.provide(getSectionAttemptState),
  GroupImpl.finalize
);
