import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";
import type { useDeleteChatMutation } from "@/components/ai/chat/mutation";
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
  /**
   * Runs once the server has deleted the chat and the learner still reads it,
   * so the page moves on.
   */
  deleted: () => void;
  /**
   * Stops showing the chat in Nina's sheet at the press, and answers whether the
   * sheet showed it, so a delete that did not happen shows it there again.
   */
  forget: () => boolean;
  /** Stops reading the chat at the press, because the server is about to delete it. */
  leave: () => void;
  /** Shows the chat in Nina's sheet again, because the delete did not happen. */
  recall: () => void;
  /** Runs when the delete did not happen, so the chat shows again. */
  refused: () => void;
  /**
   * Whether the learner still reads the page of the press. The page moves on
   * only while they do.
   */
  stillOnChat: () => boolean;
}

/**
 * Runs one press of Delete. The press closes the confirmation and leaves the
 * chat before the socket is awaited, so the page stops reading the chat at
 * once, and a second press finds the chat leaving. Nina's sheet lets the chat
 * go at the press too, because its read would fail once the server deletes it.
 * The delete starts when the socket is connected. A delete that no socket
 * carries, or that the server refuses, shows the chat in the sheet again when
 * the sheet showed it, and runs `refused`.
 */
export const deleteOnPress = Effect.fn("www.chat.deleteOnPress")(function* (
  deletion: ChatDeletion
) {
  const shown = yield* Effect.sync(() => {
    deletion.close();
    deletion.leave();
    return deletion.forget();
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
      onSuccess: () =>
        Effect.sync(() => {
          // The learner may have opened another page while the delete waited, and
          // that page stays as it is.
          if (deletion.stillOnChat()) {
            deletion.deleted();
          }
        }),
      onFailure: () =>
        Effect.sync(() => {
          if (shown) {
            deletion.recall();
          }
          deletion.refused();
        }),
    })
  );
});
