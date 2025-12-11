import type { MyUIMessage } from "@repo/ai/types/message";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth, requireChatAccess } from "../lib/authHelpers";
import { asyncMap, getManyFrom } from "../lib/relationships";
import { mapDBPartToUIMessagePart } from "./utils";

/**
 * Get a chat by its ID.
 * Requires authentication. Public chats are accessible by any logged-in user.
 * Private chats are only accessible by the owner.
 */
export const getChat = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const chat = await ctx.db.get("chats", args.chatId);
    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.chatId}`,
      });
    }

    // Use centralized chat access check
    requireChatAccess(chat.userId, user.appUser._id, chat.visibility);

    return chat;
  },
});

/**
 * Get all chats by user ID, type, visibility, and search query.
 * Only accessible by the user ID passed as an argument.
 * Supports optional full-text search by title and filtering by visibility and type.
 */
export const getChats = query({
  args: {
    userId: v.id("users"),
    q: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    type: v.optional(v.union(v.literal("study"), v.literal("finance"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { userId, q: searchQuery, visibility, type, paginationOpts } = args;

    // If search query is provided and not empty, use full-text search
    if (searchQuery && searchQuery.trim().length > 0) {
      return await ctx.db
        .query("chats")
        .withSearchIndex("search_title", (q) => {
          let builder = q.search("title", searchQuery).eq("userId", userId);
          if (visibility) {
            builder = builder.eq("visibility", visibility);
          }
          if (type) {
            builder = builder.eq("type", type);
          }
          return builder;
        })
        .paginate(paginationOpts);
    }

    // Use the most specific index available based on filters
    // Priority: userId_visibility_type > userId_type > userId_visibility > userId

    if (visibility && type) {
      // Use compound index for all three fields
      return await ctx.db
        .query("chats")
        .withIndex("userId_visibility_type", (q) =>
          q.eq("userId", userId).eq("visibility", visibility).eq("type", type)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    if (type) {
      // Use userId_type index
      return await ctx.db
        .query("chats")
        .withIndex("userId_type", (q) =>
          q.eq("userId", userId).eq("type", type)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    if (visibility) {
      // Use userId_visibility index
      return await ctx.db
        .query("chats")
        .withIndex("userId_visibility", (q) =>
          q.eq("userId", userId).eq("visibility", visibility)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    // No filters, return all user's chats
    return await ctx.db
      .query("chats")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(paginationOpts);
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
    const chat = await ctx.db.get("chats", args.chatId);
    return chat?.title;
  },
});

/**
 * Load messages for a chat.
 * Messages are ordered by creation time, parts by order field.
 * Requires authentication. Public chats are accessible by any logged-in user.
 * Private chats are only accessible by the owner.
 *
 * Note: If you have chats with 100+ messages, consider implementing pagination
 * to avoid loading all messages at once.
 */
export const loadMessages = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args): Promise<MyUIMessage[]> => {
    const user = await requireAuth(ctx);

    const chat = await ctx.db.get("chats", args.chatId);
    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.chatId}`,
      });
    }

    // Use centralized chat access check
    requireChatAccess(chat.userId, user.appUser._id, chat.visibility);

    // Get messages ordered by creation time using index
    const messages = await getManyFrom(
      ctx.db,
      "messages",
      "chatId",
      args.chatId
    );

    // Fetch parts for all messages concurrently using asyncMap
    const messagesWithParts = await asyncMap(messages, async (message) => {
      // Get parts ordered by order field using compound index
      const parts = await ctx.db
        .query("parts")
        .withIndex("messageId_order", (q) => q.eq("messageId", message._id))
        .order("asc")
        .collect();

      return { ...message, parts };
    });

    return messagesWithParts.map((message) => ({
      id: message.identifier,
      role: message.role,
      parts: message.parts.map((part) => mapDBPartToUIMessagePart({ part })),
    }));
  },
});
