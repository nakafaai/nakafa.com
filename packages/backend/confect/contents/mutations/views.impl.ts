import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contents/mutations/views.spec";
import { recordUniqueContentView } from "@repo/backend/confect/contents/views/impl";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const recordContentView = FunctionImpl.make(
  databaseSchema,
  spec,
  "recordContentView",
  Effect.fn("contents.mutations.views.recordContentView")(function* (args) {
    return yield* recordUniqueContentView(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(recordContentView),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
