import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/contents/queries/trending.spec";
import { listTrendingSubjects } from "@repo/backend/confect/contents/trending/impl";
import { Effect, Layer } from "effect";

const getTrendingSubjects = FunctionImpl.make(
  databaseSchema,
  spec,
  "getTrendingSubjects",
  Effect.fn("contents.queries.trending.getTrendingSubjects")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* listTrendingSubjects(ctx, args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getTrendingSubjects),
  GroupImpl.finalize
);
