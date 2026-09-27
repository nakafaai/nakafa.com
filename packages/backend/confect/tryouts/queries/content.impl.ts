import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/tryouts/queries/content.spec";
import { readTryoutHistory } from "@repo/backend/confect/tryouts/runtime/history/read";
import { Effect, Layer } from "effect";

const getBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "getBatch",
  Effect.fn("tryouts.queries.content.getBatch")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readTryoutHistory(ctx, args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getBatch),
  GroupImpl.finalize
);
