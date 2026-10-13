import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import { matchesShare } from "@repo/backend/confect/chats/share";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/**
 * A chat is readable by its owner, by id, and by anyone who presents the token
 * of its share. Every other read answers as if the chat did not exist, so a
 * chat id alone says nothing about a chat, whether it is private, shared or
 * gone.
 */
export const readChat = Effect.fn("chats.access.read")(function* (
  chatId: Id<"chats">,
  viewerId: Id<"users"> | null,
  shareToken?: string
) {
  const chat = yield* (yield* DatabaseReader)
    .table("chats")
    .get(chatId)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIdFailure: () => Effect.succeed(null),
      })
    );
  if (chat?.userId === viewerId) {
    return chat;
  }
  if (
    chat &&
    shareToken !== undefined &&
    (yield* matchesShare(chat._id, shareToken))
  ) {
    return chat;
  }
  return yield* new ChatAccessError({
    code: "CHAT_NOT_FOUND",
    message: `Chat not found for chatId: ${chatId}`,
  });
});
