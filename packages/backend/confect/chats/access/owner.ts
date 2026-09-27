import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** Require ownership before mutating a chat or reading its private traces. */
export const requireChatOwner = Effect.fn("chats.requireOwner")(function* (
  chatId: Id<"chats">,
  userId: Id<"users">,
  message = "You do not have permission to modify this chat."
) {
  const database = yield* DatabaseReader;
  const chat = yield* database
    .table("chats")
    .get(chatId)
    .pipe(
      Effect.catchTag("DocumentDecodeError", Effect.die),
      Effect.mapError(
        () =>
          new ChatAccessError({
            code: "CHAT_NOT_FOUND",
            message: `Chat not found for chatId: ${chatId}`,
          })
      )
    );
  if (chat.userId !== userId) {
    return yield* new ChatAccessError({
      code: "FORBIDDEN",
      message,
    });
  }
  return chat;
});
