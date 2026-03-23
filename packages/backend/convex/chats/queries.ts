import { query } from "@repo/backend/convex/_generated/server";
import {
  getMessageByIdentifier,
  verifyChatOwnership,
} from "@repo/backend/convex/chats/helpers";
import { hydrateMessagePage } from "@repo/backend/convex/chats/read";
import {
  chatTypeValidator,
  chatVisibilityValidator,
  paginatedChatsValidator,
  paginatedMessagesValidator,
} from "@repo/backend/convex/chats/schema";
import {
  getOptionalAppUserFromIdentity,
  requireAuth,
} from "@repo/backend/convex/lib/helpers/auth";
import { requireChatAccess } from "@repo/backend/convex/lib/helpers/chat";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
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
    const viewer = await getOptionalAppUserFromIdentity(ctx);
    const viewerUserId = viewer?.appUser._id ?? null;

    const chat = await ctx.db.get("chats", args.chatId);

    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.chatId}`,
      });
    }

    requireChatAccess(chat.userId, viewerUserId, chat.visibility);

    return chat;
  },
});

/**
 * Get all chats by user ID, type, visibility, and search query.
 * Owners can load all of their chats. Everyone else only sees public chats.
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
    const viewer = await getOptionalAppUserFromIdentity(ctx);
    const viewerUserId = viewer?.appUser._id ?? null;
    const isOwner = viewerUserId === userId;

    if (!isOwner && visibility === "private") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Private chats are only visible to their owner.",
      });
    }

    const effectiveVisibility = isOwner ? visibility : "public";

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

    if (effectiveVisibility && type) {
      return await ctx.db
        .query("chats")
        .withIndex("by_userId_and_visibility_and_type", (q) =>
          q
            .eq("userId", userId)
            .eq("visibility", effectiveVisibility)
            .eq("type", type)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    if (type) {
      return await ctx.db
        .query("chats")
        .withIndex("by_userId_and_type", (q) =>
          q.eq("userId", userId).eq("type", type)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    if (effectiveVisibility) {
      return await ctx.db
        .query("chats")
        .withIndex("by_userId_and_visibility", (q) =>
          q.eq("userId", userId).eq("visibility", effectiveVisibility)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    return await ctx.db
      .query("chats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
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

    const viewer = await getOptionalAppUserFromIdentity(ctx);
    const viewerUserId = viewer?.appUser._id ?? null;

    if (viewerUserId !== chat.userId) {
      return null;
    }

    return chat.title ?? null;
  },
});

/** Return one transcript page ordered from newest to oldest. */
export const loadMessagesPage = query({
  args: {
    chatId: vv.id("chats"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedMessagesValidator,
  handler: async (ctx, args) => {
    const viewer = await getOptionalAppUserFromIdentity(ctx);
    const viewerUserId = viewer?.appUser._id ?? null;

    const chat = await ctx.db.get("chats", args.chatId);

    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.chatId}`,
      });
    }

    requireChatAccess(chat.userId, viewerUserId, chat.visibility);

    const page = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: await hydrateMessagePage(ctx.db, page.page),
    };
  },
});

/** Find one persisted chat message by the UI message identifier. */
export const getMessageMatch = query({
  args: {
    chatId: vv.id("chats"),
    identifier: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      creationTime: v.number(),
      messageId: vv.id("messages"),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await verifyChatOwnership(ctx, args.chatId, user.appUser._id);

    const message = await getMessageByIdentifier(
      ctx,
      args.chatId,
      args.identifier
    );

    if (!message) {
      return null;
    }

    return {
      creationTime: message._creationTime,
      messageId: message._id,
    };
  },
});
