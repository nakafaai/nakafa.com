import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/tryouts/queries/content.spec";
import { readTryoutHistory } from "@repo/backend/confect/tryouts/runtime/history/read";
import { Effect, Layer } from "effect";

const getBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "getBatch",
  Effect.fn("tryouts.queries.content.getBatch")(function* (args) {
    return yield* readTryoutHistory(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getBatch),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
