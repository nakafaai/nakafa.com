import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { listRecentLearning } from "@repo/backend/confect/contents/queries/recent";
import spec from "@repo/backend/confect/contents/queries/recent.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const getRecentlyViewed = FunctionImpl.make(
  databaseSchema,
  spec,
  "getRecentlyViewed",
  Effect.fn("contents.queries.recent.getRecentlyViewed")(function* (args) {
    return yield* listRecentLearning(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getRecentlyViewed),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
