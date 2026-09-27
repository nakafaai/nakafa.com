import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import {
  deleteExpiredCapabilityTraces,
  saveCapabilityTrace,
} from "@repo/backend/confect/chats/traces/impl";
import spec from "@repo/backend/confect/chats/traces/mutations.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Clock, Effect, Layer } from "effect";

const save = FunctionImpl.make(
  databaseSchema,
  spec,
  "save",
  Effect.fn("chats.traces.mutations.save")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* saveCapabilityTrace(ctx, args.chatId, args.trace);
  })
);
const deleteExpiredBatch = FunctionImpl.make(
  databaseSchema,
  spec,
  "deleteExpiredBatch",
  Effect.fn("chats.traces.mutations.deleteExpiredBatch")(function* (args) {
    return yield* deleteExpiredCapabilityTraces(args);
  })
);
const sweepExpired = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweepExpired",
  Effect.fn("chats.traces.mutations.sweepExpired")(function* () {
    return yield* deleteExpiredCapabilityTraces({
      now: yield* Clock.currentTimeMillis,
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(save),
  Layer.provide(deleteExpiredBatch),
  Layer.provide(sweepExpired),
  Layer.provide(atomic),
  GroupImpl.finalize
);
