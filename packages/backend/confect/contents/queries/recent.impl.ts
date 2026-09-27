import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { listRecentLearning } from "@repo/backend/confect/contents/queries/recent";
import spec from "@repo/backend/confect/contents/queries/recent.spec";
import { Effect, Layer } from "effect";

const getRecentlyViewed = FunctionImpl.make(
  databaseSchema,
  spec,
  "getRecentlyViewed",
  Effect.fn("contents.queries.recent.getRecentlyViewed")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* listRecentLearning(ctx, args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getRecentlyViewed),
  GroupImpl.finalize
);
