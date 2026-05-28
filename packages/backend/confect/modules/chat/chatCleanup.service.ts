import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import { deleteMessageBatchFromPoint } from "@repo/backend/confect/modules/chat/chatStore.service";
import { Duration, Effect } from "effect";

/** Removes messages and parts after a chat row has been deleted. */
export const cleanupDeletedChat = Effect.fn("chatCleanup.cleanupDeletedChat")(
  function* (args: { chatId: Id<"chats"> }) {
    const scheduler = yield* Scheduler;
    const deleteResult = yield* deleteMessageBatchFromPoint({
      chatId: args.chatId,
      fromCreationTime: 0,
    });

    if (!deleteResult.hasMore) {
      return null;
    }

    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.chats.cleanup.cleanupDeletedChat,
      args
    );

    return null;
  }
);
