import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { listCapabilityTraces } from "@repo/backend/confect/chats/traces/impl";
import spec from "@repo/backend/confect/chats/traces/queries.spec";
import { Effect, Layer } from "effect";

const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("chats.traces.queries.list")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* listCapabilityTraces(ctx, args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  GroupImpl.finalize
);
