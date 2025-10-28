import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation } from "../_generated/server";
import { safeGetAppUser } from "../auth";
import tables from "./schema";

/**
 * Helper: Delete all parts for a message.
 * This operates within the same transaction as the caller.
 */
async function deletePartsForMessage(
  ctx: MutationCtx,
  messageId: Id<"messages">
) {
  const parts = await ctx.db
    .query("parts")
    .withIndex("messageId", (q) => q.eq("messageId", messageId))
    .collect();

  for (const part of parts) {
    await ctx.db.delete(part._id);
  }
}

/**
 * Helper: Delete messages and their parts from a specific message onwards.
 * This operates within the same transaction as the caller.
 */
async function deleteMessagesFromPoint(
  ctx: MutationCtx,
  chatId: Id<"chats">,
  fromCreationTime: number
) {
  const messages = await ctx.db
    .query("messages")
    .withIndex("chatId", (q) =>
      q.eq("chatId", chatId).gte("_creationTime", fromCreationTime)
    )
    .collect();

  for (const message of messages) {
    await deletePartsForMessage(ctx, message._id);
    await ctx.db.delete(message._id);
  }
}

/**
 * Create a new chat for the authenticated user with optional title.
 * Only the logged-in user can create chats for themselves.
 */
export const createChat = mutation({
  args: {
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Authentication check
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to create a chat.",
      });
    }

    const chatId = await ctx.db.insert("chats", {
      updatedAt: Date.now(),
      title: args.title || "New Chat",
      userId: user.appUser._id,
    });
    return chatId;
  },
});

/**
 * Atomically upsert a message with parts.
 * If messageId provided, deletes from that message onwards before inserting (for regenerate).
 * Parts messageId is omitted - set internally after message creation.
 * Only the chat owner can add messages.
 */
export const upsertMessageWithParts = mutation({
  args: {
    message: tables.messages.validator,
    parts: v.array(
      v.object({
        ...tables.parts.validator.fields,
        messageId: v.optional(v.id("messages")),
      })
    ),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Authentication check
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to add messages.",
      });
    }

    // Authorization check - verify user owns the chat
    const chat = await ctx.db.get(args.message.chatId);
    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.message.chatId}`,
      });
    }

    if (chat.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to add messages to this chat.",
      });
    }

    if (args.messageId) {
      const targetMessage = await ctx.db
        .query("messages")
        .withIndex("identifier", (q) =>
          q.eq("identifier", args.message.identifier)
        )
        .unique();

      if (targetMessage) {
        await deleteMessagesFromPoint(
          ctx,
          targetMessage.chatId,
          targetMessage._creationTime
        );
      }
    }

    // Create message
    const messageId = await ctx.db.insert("messages", {
      chatId: args.message.chatId,
      role: args.message.role,
      identifier: args.message.identifier,
    });

    // Insert parts with messageId
    const partIds: Id<"parts">[] = [];
    for (const part of args.parts) {
      const partId = await ctx.db.insert("parts", {
        ...part,
        messageId,
      });
      partIds.push(partId);
    }

    return { messageId, partIds };
  },
});

/**
 * Atomically create a chat with initial message and parts.
 * Message chatId and parts messageId are omitted - set internally after creation.
 * Only the logged-in user can create chats for themselves.
 */
export const createChatWithMessage = mutation({
  args: {
    title: v.optional(v.string()),
    message: v.object({
      ...tables.messages.validator.fields,
      chatId: v.optional(v.id("chats")),
    }),
    parts: v.array(
      v.object({
        ...tables.parts.validator.fields,
        messageId: v.optional(v.id("messages")),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Authentication check
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to create a chat.",
      });
    }

    // Create chat
    const chatId = await ctx.db.insert("chats", {
      updatedAt: Date.now(),
      title: args.title || "New Chat",
      userId: user.appUser._id,
    });

    // Create first message
    const messageId = await ctx.db.insert("messages", {
      chatId,
      role: args.message.role,
      identifier: args.message.identifier,
    });

    // Insert parts with messageId
    const partIds: Id<"parts">[] = [];
    for (const part of args.parts) {
      const partId = await ctx.db.insert("parts", {
        ...part,
        messageId,
      });
      partIds.push(partId);
    }

    return { chatId, messageId, partIds };
  },
});
