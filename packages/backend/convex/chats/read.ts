import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { MAX_CHAT_MESSAGE_PARTS } from "@repo/backend/convex/chats/constants";
import type { MessageWithPartsDoc } from "@repo/backend/convex/chats/schema";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";

/** Hydrate one page of chat messages with their parts. */
export async function hydrateMessagePage(
  db: QueryCtx["db"],
  messages: Array<
    Omit<MessageWithPartsDoc, "parts"> & {
      _id: Id<"messages">;
    }
  >
): Promise<MessageWithPartsDoc[]> {
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
