import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE,
  MAX_CHAT_MESSAGE_PARTS,
} from "@repo/backend/convex/chats/constants";
import type { partValidator } from "@repo/backend/convex/chats/schema";
import type { Infer } from "convex/values";
import { ConvexError } from "convex/values";

type PartInput = Omit<Infer<typeof partValidator>, "messageId">;

/** Load one chat and require that the current user owns it. */
export async function verifyChatOwnership(
  ctx: MutationCtx | QueryCtx,
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

async function deletePartsForMessageBatch(
  ctx: MutationCtx,
  messageId: Id<"messages">
) {
  const parts = await ctx.db
    .query("parts")
    .withIndex("by_messageId_and_order", (q) => q.eq("messageId", messageId))
    .take(MAX_CHAT_MESSAGE_PARTS + 1);

  for (const part of parts.slice(0, MAX_CHAT_MESSAGE_PARTS)) {
    await ctx.db.delete("parts", part._id);
  }

  return {
    hasMore: parts.length > MAX_CHAT_MESSAGE_PARTS,
  };
}

/**
 * Delete one bounded transcript batch from a creation time onward.
 * This supports message regeneration without loading an unbounded mutation.
 */
export async function deleteMessageBatchFromPoint(
  ctx: MutationCtx,
  chatId: Id<"chats">,
  fromCreationTime: number
) {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_chatId", (q) =>
      q.eq("chatId", chatId).gte("_creationTime", fromCreationTime)
    )
    .take(CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE);

  if (messages.length === 0) {
    return { hasMore: false };
  }

  for (const message of messages) {
    const partsBatch = await deletePartsForMessageBatch(ctx, message._id);

    if (partsBatch.hasMore) {
      return { hasMore: true };
    }

    await ctx.db.delete("messages", message._id);
  }

  return {
    hasMore: messages.length === CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE,
  };
}

/** Find the persisted message that matches one UI message identifier. */
export function getMessageByIdentifier(
  ctx: MutationCtx | QueryCtx,
  chatId: Id<"chats">,
  identifier: string
) {
  return ctx.db
    .query("messages")
    .withIndex("by_chatId_and_identifier", (q) =>
      q.eq("chatId", chatId).eq("identifier", identifier)
    )
    .unique();
}

/** Insert all parts for one chat message. */
export async function insertParts(
  ctx: MutationCtx,
  messageId: Id<"messages">,
  parts: PartInput[]
): Promise<Id<"parts">[]> {
  if (parts.length > MAX_CHAT_MESSAGE_PARTS) {
    throw new ConvexError({
      code: "CHAT_PART_LIMIT_EXCEEDED",
      message: `Chat message cannot have more than ${MAX_CHAT_MESSAGE_PARTS} parts.`,
    });
  }

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
