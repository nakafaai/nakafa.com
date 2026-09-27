import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/tryouts/queries/sets.spec";
import { listPublishedSets } from "@repo/backend/confect/tryouts/sets/published";
import { Effect, Layer } from "effect";

const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tryouts.queries.sets.list")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* listPublishedSets(ctx, args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  GroupImpl.finalize
);
