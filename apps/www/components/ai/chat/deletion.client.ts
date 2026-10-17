"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";
import type { useDeleteChatMutation } from "@/components/ai/chat/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import { requireConvexOnline } from "@/lib/convex/online";

/** What one press of Delete holds: the chat, the client, the delete, and what the page does with each answer. */
interface ChatDeletion {
  /** The chat the learner deletes. */
  chatId: Id<"chats">;
  /** Closes the confirmation at the press. */
  close: () => void;
  /** The client, whose socket must be connected before the delete starts. */
  convex: Parameters<typeof requireConvexOnline>[0];
  /** Sends the delete to the server. */
  deleteChat: ReturnType<typeof useDeleteChatMutation>;
  /** Runs once the server has deleted the chat, so the page moves on. */
  deleted: () => void;
  /** Stops reading the chat at the press, because the server is about to delete it. */
  leave: () => void;
  /** Runs when the delete did not happen, so the chat shows again. */
  refused: () => void;
}

/**
 * Runs one press of Delete. The press closes the confirmation and leaves the
 * chat before the socket is awaited, so the page stops reading the chat at
 * once, and a second press finds the chat leaving. The delete starts when the
 * socket is connected. A delete that no socket carries, or that the server
 * refuses, runs `refused`.
 */
export const deleteOnPress = Effect.fn("www.chat.deleteOnPress")(function* (
  deletion: ChatDeletion
) {
  yield* Effect.sync(() => {
    deletion.close();
    deletion.leave();
  });
  yield* requireConvexOnline(deletion.convex).pipe(
    Effect.andThen(
      Effect.tryPromise(() =>
        deletion.deleteChat({ chatId: deletion.chatId })
      ).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.tapError((error) =>
          reportClientException(error, {
            source: "components/ai/chat/deletion",
          })
        )
      )
    ),
    Effect.matchEffect({
      onSuccess: () => Effect.sync(deletion.deleted),
      onFailure: () => Effect.sync(deletion.refused),
    })
  );
});
