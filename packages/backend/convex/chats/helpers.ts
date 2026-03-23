import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  MAX_CHAT_MESSAGE_PARTS,
  MAX_CHAT_MESSAGES_PER_MUTATION_DELETE,
} from "@repo/backend/convex/chats/constants";
import type { partValidator } from "@repo/backend/convex/chats/schema";
import type { Infer } from "convex/values";
import { ConvexError } from "convex/values";

type PartInput = Omit<Infer<typeof partValidator>, "messageId">;

/**
 * Verify the current user owns the chat.
 * Throws ConvexError if chat not found or user doesn't have permission.
 *
 * @param ctx - Convex mutation context
 * @param chatId - ID of the chat to check
 * @param userId - ID of the current user
 * @returns The chat document
 * @throws {ConvexError} If chat not found or FORBIDDEN
 */
export async function verifyChatOwnership(
  ctx: MutationCtx,
  chatId: Id<"chats">,
  userId: Id<"users">
) {
  const chat = await ctx.db.get("chats", chatId);

  if (!chat) {
    throw new ConvexError({
      code: "CHAT_NOT_FOUND",
      message: `Chat not found for chatId: ${chatId}`,
    });
  }

  if (chat.userId !== userId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have permission to modify this chat.",
    });
  }

  return chat;
}

/**
 * Delete all parts for a message.
 * This operates within the same transaction as the caller.
 *
 * @param ctx - Convex mutation context
 * @param messageId - ID of the message whose parts should be deleted
 */
async function deletePartsForMessage(
  ctx: MutationCtx,
  messageId: Id<"messages">
) {
  const parts = await ctx.db
    .query("parts")
    .withIndex("messageId_order", (q) => q.eq("messageId", messageId))
    .take(MAX_CHAT_MESSAGE_PARTS + 1);

  if (parts.length > MAX_CHAT_MESSAGE_PARTS) {
    throw new ConvexError({
      code: "CHAT_MESSAGE_PART_LIMIT_EXCEEDED",
      message: "Chat message part count exceeds the supported delete limit.",
    });
  }

  for (const part of parts) {
    await ctx.db.delete("parts", part._id);
  }
}

/**
 * Delete messages and their parts from a specific message onwards.
 * This operates within the same transaction as the caller.
 *
 * @param ctx - Convex mutation context
 * @param chatId - ID of the chat
 * @param fromCreationTime - Delete messages with _creationTime >= this value
 */
export async function deleteMessagesFromPoint(
  ctx: MutationCtx,
  chatId: Id<"chats">,
  fromCreationTime: number
) {
  const messages = await ctx.db
    .query("messages")
    .withIndex("chatId", (q) =>
      q.eq("chatId", chatId).gte("_creationTime", fromCreationTime)
    )
    .take(MAX_CHAT_MESSAGES_PER_MUTATION_DELETE + 1);

  if (messages.length > MAX_CHAT_MESSAGES_PER_MUTATION_DELETE) {
    throw new ConvexError({
      code: "CHAT_DELETE_LIMIT_EXCEEDED",
      message:
        "Chat message delete count exceeds the supported mutation limit.",
    });
  }

  for (const message of messages) {
    await deletePartsForMessage(ctx, message._id);
    await ctx.db.delete("messages", message._id);
  }
}

/**
 * Delete a message and all subsequent messages by identifier.
 * Used for message replacement/upsert behavior.
 *
 * @param ctx - Convex mutation context
 * @param chatId - ID of the chat
 * @param identifier - Message identifier to find and delete
 */
export async function deleteMessageByIdentifier(
  ctx: MutationCtx,
  chatId: Id<"chats">,
  identifier: string
) {
  const targetMessage = await ctx.db
    .query("messages")
    .withIndex("chatId_identifier", (q) =>
      q.eq("chatId", chatId).eq("identifier", identifier)
    )
    .unique();

  if (targetMessage && targetMessage.chatId === chatId) {
    await deleteMessagesFromPoint(ctx, chatId, targetMessage._creationTime);
  }
}

/**
 * Insert parts for a message.
 *
 * @param ctx - Convex mutation context
 * @param messageId - ID of the message to attach parts to
 * @param parts - Array of parts to insert
 * @returns Array of inserted part IDs
 */
export async function insertParts(
  ctx: MutationCtx,
  messageId: Id<"messages">,
  parts: PartInput[]
): Promise<Id<"parts">[]> {
  const partIds: Id<"parts">[] = [];

  for (const part of parts) {
    const partId = await ctx.db.insert("parts", {
      ...part,
      messageId,
    });
    partIds.push(partId);
  }

  return partIds;
}
