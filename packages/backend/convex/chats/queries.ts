import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import {
  chatTypeValidator,
  chatVisibilityValidator,
  messageWithPartsDocValidator,
  paginatedChatsValidator,
} from "@repo/backend/convex/chats/schema";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requireChatAccess } from "@repo/backend/convex/lib/helpers/chat";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getManyFrom } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

async function getViewerUserId(ctx: Pick<QueryCtx, "auth" | "db">) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity?.subject) {
    return null;
  }

  const appUser = await ctx.db
    .query("users")
    .withIndex("authId", (q) => q.eq("authId", identity.subject))
    .unique();

  return appUser?._id ?? null;
}

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
 * Owners can load all of their chats. Everyone else only sees public chats.
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
    const viewerUserId = await getViewerUserId(ctx);
    const isOwner = viewerUserId === userId;

    if (!isOwner && visibility === "private") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Private chats are only visible to their owner.",
      });
    }

    const effectiveVisibility = isOwner ? visibility : "public";

    // If search query is provided and not empty, use full-text search
    if (searchQuery && searchQuery.trim().length > 0) {
      return await ctx.db
        .query("chats")
        .withSearchIndex("search_title", (q) => {
          let builder = q.search("title", searchQuery).eq("userId", userId);
          if (effectiveVisibility) {
            builder = builder.eq("visibility", effectiveVisibility);
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

    if (effectiveVisibility && type) {
      // Use compound index for all three fields
      return await ctx.db
        .query("chats")
        .withIndex("userId_visibility_type", (q) =>
          q
            .eq("userId", userId)
            .eq("visibility", effectiveVisibility)
            .eq("type", type)
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

    if (effectiveVisibility) {
      // Use userId_visibility index
      return await ctx.db
        .query("chats")
        .withIndex("userId_visibility", (q) =>
          q.eq("userId", userId).eq("visibility", effectiveVisibility)
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
 * Public chat titles are readable by anyone.
 * Private chat titles are only readable by the owner.
 */
export const getChatTitle = query({
  args: {
    chatId: vv.id("chats"),
  },
  returns: nullable(v.string()),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get("chats", args.chatId);

    if (!chat) {
      return null;
    }

    if (chat.visibility === "public") {
      return chat.title ?? null;
    }

    const viewerUserId = await getViewerUserId(ctx);

    if (viewerUserId !== chat.userId) {
      return null;
    }

    return chat.title ?? null;
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
