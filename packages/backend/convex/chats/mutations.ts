import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import tables, {
  chatTypeValidator,
  chatVisibilityValidator,
} from "@repo/backend/convex/chats/schema";
import { mutation } from "@repo/backend/convex/functions";
import {
  requireAuth,
  requireAuthWithSession,
} from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators";
import { ConvexError, v } from "convex/values";

/**
 * Helper: Delete all parts for a message.
 * This operates within the same transaction as the caller.
 */
async function deletePartsForMessage(
  ctx: MutationCtx,
  messageId: Id<"messages">
) {
  // Use compound index, omit order condition to get all parts
  const parts = await ctx.db
    .query("parts")
    .withIndex("messageId_order", (q) => q.eq("messageId", messageId))
    .collect();

  for (const part of parts) {
    await ctx.db.delete("parts", part._id);
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
    await ctx.db.delete("messages", message._id);
  }
}

/**
 * Create a new chat for the authenticated user with optional title.
 * Only the logged-in user can create chats for themselves.
 */
export const createChat = mutation({
  args: {
    title: v.optional(v.string()),
    type: chatTypeValidator,
  },
  returns: vv.id("chats"),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);

    const chatId = await ctx.db.insert("chats", {
      updatedAt: Date.now(),
      title: args.title || "New Chat",
      userId: user.appUser._id,
      visibility: "private", // default to private
      type: args.type,
    });
    return chatId;
  },
});

/**
 * Update the title of a chat.
 * Only the chat owner can update the title.
 */
export const updateChatTitle = mutation({
  args: {
    chatId: vv.id("chats"),
    title: v.string(),
  },
  returns: vv.id("chats"),
  handler: async (ctx, args) => {
    // We need fast access, so we use requireAuth instead of requireAuthWithSession
    const user = await requireAuth(ctx);

    const chat = await ctx.db.get("chats", args.chatId);
    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.chatId}`,
      });
    }

    if (chat.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to update the chat title.",
      });
    }

    await ctx.db.patch("chats", chat._id, { title: args.title });

    return chat._id;
  },
});

/**
 * Update the visibility of a chat.
 * Only the chat owner can update the visibility.
 */
export const updateChatVisibility = mutation({
  args: {
    chatId: vv.id("chats"),
    visibility: chatVisibilityValidator,
  },
  returns: vv.id("chats"),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);

    const chat = await ctx.db.get("chats", args.chatId);
    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.chatId}`,
      });
    }

    if (chat.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to update the chat visibility.",
      });
    }

    await ctx.db.patch("chats", chat._id, { visibility: args.visibility });

    return chat._id;
  },
});

/**
 * Atomically replace a message with parts.
 * If identifier exists, deletes that message (and all subsequent messages) before inserting.
 * This ensures one message per identifier, but creates a new _id each time.
 * Parts messageId is omitted - set internally after message creation.
 * Only the chat owner can add messages.
 */
export const replaceMessageWithParts = mutation({
  args: {
    message: tables.messages.validator,
    parts: v.array(
      v.object({
        ...tables.parts.validator.fields,
        messageId: v.optional(vv.id("messages")), // make it optional here to allow for upserting parts without a messageId
      })
    ),
  },
  returns: v.object({
    messageId: vv.id("messages"),
    partIds: v.array(vv.id("parts")),
  }),
  handler: async (ctx, args) => {
    const { message, parts } = args;

    // We need fast access, so we use requireAuth instead of requireAuthWithSession
    const user = await requireAuth(ctx);

    // Authorization check - verify user owns the chat
    const chat = await ctx.db.get("chats", message.chatId);
    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${message.chatId}`,
      });
    }

    if (chat.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to add messages to this chat.",
      });
    }

    if (message.identifier) {
      const targetMessage = await ctx.db
        .query("messages")
        .withIndex("identifier", (q) => q.eq("identifier", message.identifier))
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
      chatId: message.chatId,
      role: message.role,
      identifier: message.identifier,
    });

    // Insert parts with messageId
    const partIds: Id<"parts">[] = [];
    for (const part of parts) {
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
    type: chatTypeValidator,
    message: v.object({
      ...tables.messages.validator.fields,
      chatId: v.optional(vv.id("chats")), // make it optional here to allow for creating a chat with a message without a chatId
    }),
    parts: v.array(
      v.object({
        ...tables.parts.validator.fields,
        messageId: v.optional(vv.id("messages")), // make it optional here to allow for creating a chat with a message without a messageId
      })
    ),
  },
  returns: v.object({
    chatId: vv.id("chats"),
    messageId: vv.id("messages"),
    partIds: v.array(vv.id("parts")),
  }),
  handler: async (ctx, args) => {
    // We need fast access, so we use requireAuth instead of requireAuthWithSession
    const user = await requireAuth(ctx);

    // Create chat
    const chatId = await ctx.db.insert("chats", {
      updatedAt: Date.now(),
      title: args.title || "New Chat",
      userId: user.appUser._id,
      visibility: "private", // default to private
      type: args.type,
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

/**
 * Delete a chat.
 * Only the chat owner can delete their own chats.
 */
export const deleteChat = mutation({
  args: {
    chatId: vv.id("chats"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);

    const chat = await ctx.db.get("chats", args.chatId);
    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.chatId}`,
      });
    }

    if (chat.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You can only delete your own chats.",
      });
    }

    await ctx.db.delete("chats", args.chatId);
    return null;
  },
});
