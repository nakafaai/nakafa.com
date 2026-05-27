import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { deleteMessageBatchFromPoint } from "@repo/backend/confect/modules/chat/chatStore.service";
import { Effect } from "effect";

/** Removes messages and parts after a chat row has been deleted. */
export const cleanupDeletedChat = Effect.fn("chatCleanup.cleanupDeletedChat")(
  function* (args: { chatId: Id<"chats"> }) {
    const ctx = yield* MutationCtx;
    const deleteResult = yield* deleteMessageBatchFromPoint({
      chatId: args.chatId,
      fromCreationTime: 0,
    });

    if (!deleteResult.hasMore) {
      return null;
    }

    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        0,
        Ref.getFunctionReference(
          refs.internal.triggers.chats.cleanup.cleanupDeletedChat
        ),
        args
      )
    );

    return null;
  }
);
