import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  MAX_CHAT_MESSAGE_PARTS,
  MAX_CHAT_MESSAGES_PER_LOAD,
} from "@repo/backend/convex/chats/constants";
import type { MessageWithPartsDoc } from "@repo/backend/convex/chats/schema";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";

/**
 * Load one chat transcript with all message parts under bounded read limits.
 * Throws when the transcript grows beyond the supported whole-chat read shape.
 */
export async function loadChatMessages(
  db: QueryCtx["db"],
  chatId: Id<"chats">
): Promise<MessageWithPartsDoc[]> {
  const messages = await db
    .query("messages")
    .withIndex("chatId", (q) => q.eq("chatId", chatId))
    .order("asc")
    .take(MAX_CHAT_MESSAGES_PER_LOAD + 1);

  if (messages.length > MAX_CHAT_MESSAGES_PER_LOAD) {
    throw new ConvexError({
      code: "CHAT_MESSAGE_LIMIT_EXCEEDED",
      message: "Chat message count exceeds the supported load limit.",
    });
  }

  return await asyncMap(messages, async (message) => {
    const parts = await db
      .query("parts")
      .withIndex("messageId_order", (q) => q.eq("messageId", message._id))
      .order("asc")
      .take(MAX_CHAT_MESSAGE_PARTS + 1);

    if (parts.length > MAX_CHAT_MESSAGE_PARTS) {
      throw new ConvexError({
        code: "CHAT_MESSAGE_PART_LIMIT_EXCEEDED",
        message: "Chat message part count exceeds the supported load limit.",
      });
    }

    return { ...message, parts };
  });
}
