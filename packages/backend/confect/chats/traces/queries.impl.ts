import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { listCapabilityTraces } from "@repo/backend/confect/chats/traces/impl";
import spec from "@repo/backend/confect/chats/traces/queries.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("chats.traces.queries.list")(function* (args) {
    return yield* listCapabilityTraces(args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
