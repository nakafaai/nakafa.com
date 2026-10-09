import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** Public transcripts are readable by anyone; private transcripts require ownership. */
export const readChat = Effect.fn("chats.access.read")(function* (
  chatId: Id<"chats">,
  viewerId: Id<"users"> | null
) {
  const reader = yield* DatabaseReader;
  const chat = yield* reader
    .table("chats")
    .get(chatId)
    .pipe(
      Effect.catchTag("DocumentDecodeError", Effect.die),
      Effect.mapError(() =>
        ChatAccessError.make({
          code: "CHAT_NOT_FOUND",
          message: `Chat not found for chatId: ${chatId}`,
        })
      )
    );
  if (chat.visibility === "private" && chat.userId !== viewerId) {
    return yield* ChatAccessError.make({
      code: "FORBIDDEN",
      message: "You do not have permission to access this private chat.",
    });
  }
  return chat;
});
