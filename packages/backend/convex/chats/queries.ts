import { query } from "@repo/backend/convex/_generated/server";
import { ninaContextSnapshotValidator } from "@repo/backend/convex/chats/context";
import { hydrateMessagePage } from "@repo/backend/convex/chats/read";
import {
  chatTypeValidator,
  chatVisibilityValidator,
  paginatedChatsValidator,
  paginatedMessagesValidator,
} from "@repo/backend/convex/chats/schema";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { requireChatAccess } from "@repo/backend/convex/lib/helpers/chat";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { nullable } from "convex-helpers/validators";

const LATEST_NINA_CONTEXT_SCAN_LIMIT = 20;

/**
 * Get a chat by its ID.
 * Public chats are readable by signed-in and signed-out viewers.
 * Private chats are only readable by the owner.
 */
export const getChat = query({
  args: {
    chatId: vv.id("chats"),
  },
  returns: vv.doc("chats"),
  handler: async (ctx, args) => {
    const viewer = await getOptionalAppUser(ctx);
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
 * Empty paginated chat result for private scopes the viewer cannot read.
 */
const emptyChatsPage = {
  continueCursor: "",
  isDone: true,
  page: [],
};

/**
 * Get public chats by user ID, type, visibility, and search query.
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
  handler: (ctx, args) => {
    const { userId, q: searchQuery, visibility, type, paginationOpts } = args;

    if (visibility === "private") {
      return emptyChatsPage;
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      return ctx.db
        .query("chats")
        .withSearchIndex("search_title", (q) => {
          let builder = q.search("title", searchQuery).eq("userId", userId);

          builder = builder.eq("visibility", "public");

          if (type) {
            builder = builder.eq("type", type);
          }

          return builder;
        })
        .paginate(paginationOpts);
    }

    if (type) {
      return ctx.db
        .query("chats")
        .withIndex("by_userId_and_visibility_and_type", (q) =>
          q.eq("userId", userId).eq("visibility", "public").eq("type", type)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    return ctx.db
      .query("chats")
      .withIndex("by_userId_and_visibility", (q) =>
        q.eq("userId", userId).eq("visibility", "public")
      )
      .order("desc")
      .paginate(paginationOpts);
  },
});

/**
 * Get the signed-in user's chats, including private chats.
 */
export const getOwnChats = query({
  args: {
    q: v.optional(v.string()),
    visibility: v.optional(chatVisibilityValidator),
    type: v.optional(chatTypeValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedChatsValidator,
  handler: async (ctx, args) => {
    const { q: searchQuery, visibility, type, paginationOpts } = args;
    const viewer = await getOptionalAppUser(ctx);

    if (!viewer) {
      return emptyChatsPage;
    }

    const userId = viewer.appUser._id;

    if (searchQuery && searchQuery.trim().length > 0) {
      return ctx.db
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

    if (visibility && type) {
      return ctx.db
        .query("chats")
        .withIndex("by_userId_and_visibility_and_type", (q) =>
          q.eq("userId", userId).eq("visibility", visibility).eq("type", type)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    if (type) {
      return ctx.db
        .query("chats")
        .withIndex("by_userId_and_type", (q) =>
          q.eq("userId", userId).eq("type", type)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    if (visibility) {
      return ctx.db
        .query("chats")
        .withIndex("by_userId_and_visibility", (q) =>
          q.eq("userId", userId).eq("visibility", visibility)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    return ctx.db
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

    const viewer = await getOptionalAppUser(ctx);
    const viewerUserId = viewer?.appUser._id ?? null;

    if (viewerUserId !== chat.userId) {
      return null;
    }

    return chat.title ?? null;
  },
});

/** Returns the newest stored Nina context snapshot for continuing a chat. */
export const getLatestNinaContext = query({
  args: {
    chatId: vv.id("chats"),
  },
  returns: nullable(ninaContextSnapshotValidator),
  handler: async (ctx, args) => {
    const viewer = await getOptionalAppUser(ctx);
    const viewerUserId = viewer?.appUser._id ?? null;

    const chat = await ctx.db.get(args.chatId);

    if (!chat) {
      throw new ConvexError({
        code: "CHAT_NOT_FOUND",
        message: `Chat not found for chatId: ${args.chatId}`,
      });
    }

    requireChatAccess(chat.userId, viewerUserId, chat.visibility);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .take(LATEST_NINA_CONTEXT_SCAN_LIMIT);

    return (
      messages.find((message) => message.ninaContextSnapshot)
        ?.ninaContextSnapshot ?? null
    );
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
    const viewer = await getOptionalAppUser(ctx);
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
