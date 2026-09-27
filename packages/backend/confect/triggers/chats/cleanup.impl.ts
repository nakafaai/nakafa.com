import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import { deleteMessageBatchFromPoint } from "@repo/backend/confect/chats/transcript/write";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import spec from "@repo/backend/confect/triggers/chats/cleanup.spec";
import { Duration, Effect, Layer } from "effect";

const cleanupDeletedChat = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedChat",
  Effect.fn("triggers.chats.cleanup.cleanupDeletedChat")(function* (args) {
    const deleteResult = yield* deleteMessageBatchFromPoint(args.chatId, 0);
    if (!deleteResult.hasMore) {
      return null;
    }
    const scheduler = yield* Scheduler;
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.triggers.chats.cleanup.cleanupDeletedChat,
      args
    );
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cleanupDeletedChat),
  Layer.provide(atomic),
  GroupImpl.finalize
);
