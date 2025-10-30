import type { MyUIMessage } from "@repo/ai/types/message";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { safeGetAppUser } from "../auth";
import { mapDBPartToUIMessagePart } from "./utils";

/**
 * Get a chat by its ID.
 * Only accessible by the chat owner.
 */
export const getChat = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to get a chat.",
      });
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.chatId}`,
      });
    }

    if (chat.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to access this chat.",
      });
    }

    return chat;
  },
});

/**
 * Get all chats for the authenticated user.
 * Only accessible by the authenticated user.
 */
export const getChats = query({
  handler: async (ctx) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to get chats.",
      });
    }

    const chats = await ctx.db
      .query("chats")
      .withIndex("userId", (q) => q.eq("userId", user.appUser._id))
      .order("desc")
      .collect();

    return chats;
  },
});

/**
 * Get the title of a chat.
 * Accessible by anyone.
 */
export const getChatTitle = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    return chat?.title;
  },
});

/**
 * Load messages for a chat.
 * Messages are ordered by creation time, parts by order field.
 * Only accessible by the chat owner.
 *
 * Note: If you have chats with 100+ messages, consider implementing pagination
 * to avoid loading all messages at once.
 */
export const loadMessages = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args): Promise<MyUIMessage[]> => {
    // Authentication check
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to load messages.",
      });
    }

    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.chatId}`,
      });
    }

    // Authorization check - verify user owns this chat
    if (chat.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to access this chat.",
      });
    }

    // Get messages ordered by creation time using index
    const messages = await ctx.db
      .query("messages")
      .withIndex("chatId", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();

    // Fetch parts for all messages concurrently
    const messagesWithParts = await Promise.all(
      messages.map(async (message) => {
        // Get parts ordered by order field using compound index
        const parts = await ctx.db
          .query("parts")
          .withIndex("messageId_order", (q) => q.eq("messageId", message._id))
          .order("asc")
          .collect();

        return {
          ...message,
          parts,
        };
      })
    );

    return messagesWithParts.map((message) => ({
      id: message.identifier,
      role: message.role,
      parts: message.parts.map((part) => mapDBPartToUIMessagePart({ part })),
    }));
  },
});
