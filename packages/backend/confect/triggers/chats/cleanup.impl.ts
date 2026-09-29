import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import spec from "@repo/backend/confect/triggers/chats/cleanup.spec";
import { Duration, Effect, Layer } from "effect";

const cleanupDeletedChat = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedChat",
  Effect.fn("triggers.chats.cleanup.cleanupDeletedChat")(function* (args) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    // The rolling summary holds conversation content, so it leaves with the chat.
    const summary = yield* reader
      .table("ninaSummaries")
      .get("by_chatId", args.chatId)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (summary) {
      yield* writer
        .table("ninaSummaries")
        .delete(summary._id)
        .pipe(Effect.orDie);
    }
    const turns = yield* reader
      .table("ninaTurns")
      .index("by_chatId_and_order", (index) => index.eq("chatId", args.chatId))
      .take(20)
      .pipe(Effect.orDie);
    for (const turn of turns) {
      yield* writer.table("ninaTurns").delete(turn._id).pipe(Effect.orDie);
    }
    if (turns.length < 20) {
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
