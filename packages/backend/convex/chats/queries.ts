import { query } from "@repo/backend/convex/_generated/server";
import type { MessageWithPartsDoc } from "@repo/backend/convex/chats/schema";
import {
  chatTypeValidator,
  chatVisibilityValidator,
  messageWithPartsDocValidator,
  paginatedChatsValidator,
} from "@repo/backend/convex/chats/schema";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requireChatAccess } from "@repo/backend/convex/lib/helpers/chat";
import { vv } from "@repo/backend/convex/lib/validators";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getManyFrom } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

/**
 * Get a chat by its ID.
 * Requires authentication. Public chats are accessible by any logged-in user.
 * Private chats are only accessible by the owner.
 */
export const getChat = query({
  args: {
    chatId: vv.id("chats"),
  },
  returns: vv.doc("chats"),
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
    userId: vv.id("users"),
    q: v.optional(v.string()),
    visibility: v.optional(chatVisibilityValidator),
    type: v.optional(chatTypeValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedChatsValidator,
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
    chatId: vv.id("chats"),
  },
  returns: nullable(v.string()),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("chats", args.chatId);
    return chat?.title ?? null;
  },
});

/**
 * Load messages for a chat.
 * Messages are ordered by creation time, parts by order field.
 * Requires authentication. Public chats are accessible by any logged-in user.
 * Private chats are only accessible by the owner.
 *
 * Returns raw DB documents. Use mapDBMessagesToUIMessages from chats/utils
 * to transform to UI messages on the client side.
 *
 * Note: If you have chats with 100+ messages, consider implementing pagination
 * to avoid loading all messages at once.
 */
export const loadMessages = query({
  args: {
    chatId: vv.id("chats"),
  },
  returns: v.array(messageWithPartsDocValidator),
  handler: async (ctx, args): Promise<MessageWithPartsDoc[]> => {
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

    return messagesWithParts;
  },
});
