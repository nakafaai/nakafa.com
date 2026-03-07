import { getModelCreditCost } from "@repo/ai/config/models";
import { DEFAULT_TITLE } from "@repo/ai/features/constants";
import {
  deleteMessageByIdentifier,
  insertParts,
  verifyChatOwnership,
} from "@repo/backend/convex/chats/helpers";
import tables, {
  chatTypeValidator,
  chatVisibilityValidator,
} from "@repo/backend/convex/chats/schema";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import {
  requireAuth,
  requireAuthWithSession,
} from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";

/** Creates a new chat for the authenticated user. */
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
      title: args.title || DEFAULT_TITLE,
      userId: user.appUser._id,
      visibility: "private", // default to private
      type: args.type,
    });
    return chatId;
  },
});

/** Updates the title of a chat. Only the owner can rename. */
export const updateChatTitle = mutation({
  args: {
    chatId: vv.id("chats"),
    title: v.string(),
  },
  returns: vv.id("chats"),
  handler: async (ctx, args) => {
    // Fast JWT auth — no session DB call needed here
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

/** Updates the visibility of a chat. Only the owner can change it. */
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
 * Saves a user message with parts.
 * If an existing message shares the same identifier it is replaced (upsert semantics).
 */
export const saveMessage = mutation({
  args: {
    message: tables.messages.validator,
    parts: v.array(
      v.object({
        ...tables.parts.validator.fields,
        messageId: v.optional(vv.id("messages")),
      })
    ),
  },
  returns: v.object({
    messageId: vv.id("messages"),
    partIds: v.array(vv.id("parts")),
  }),
  handler: async (ctx, args) => {
    const { message, parts } = args;

    // Fast JWT auth — no session DB call needed here
    const user = await requireAuth(ctx);

    await verifyChatOwnership(ctx, message.chatId, user.appUser._id);

    if (message.identifier) {
      await deleteMessageByIdentifier(ctx, message.chatId, message.identifier);
    }

    // modelId stored server-side so clients cannot spoof credit calculations
    const messageId = await ctx.db.insert("messages", {
      chatId: message.chatId,
      role: message.role,
      identifier: message.identifier,
      modelId: message.modelId,
    });

    const partIds = await insertParts(ctx, messageId, parts);

    return { messageId, partIds };
  },
});

/** Atomically creates a chat with its first message and parts. */
export const createChatWithMessage = mutation({
  args: {
    title: v.optional(v.string()),
    type: chatTypeValidator,
    message: v.object({
      ...tables.messages.validator.fields,
      chatId: v.optional(vv.id("chats")),
    }),
    parts: v.array(
      v.object({
        ...tables.parts.validator.fields,
        messageId: v.optional(vv.id("messages")),
      })
    ),
  },
  returns: v.object({
    chatId: vv.id("chats"),
    messageId: vv.id("messages"),
    partIds: v.array(vv.id("parts")),
  }),
  handler: async (ctx, args) => {
    // Fast JWT auth — no session DB call needed here
    const user = await requireAuth(ctx);

    const chatId = await ctx.db.insert("chats", {
      updatedAt: Date.now(),
      title: args.title || DEFAULT_TITLE,
      userId: user.appUser._id,
      visibility: "private",
      type: args.type,
    });

    const messageId = await ctx.db.insert("messages", {
      chatId,
      role: args.message.role,
      identifier: args.message.identifier,
    });

    const partIds = await insertParts(ctx, messageId, args.parts);

    return { chatId, messageId, partIds };
  },
});

/** Deletes a chat. Only the owner can delete their own chats. */
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

/**
 * Persists an assistant message with parts and deducts credits atomically.
 *
 * Credits are deducted *after* streaming (via waitUntil). The pre-check in
 * route.ts is the real gate — a small negative balance is intentionally
 * allowed here to avoid erroring mid-stream.
 */
export const saveAssistantResponse = internalMutation({
  args: {
    userId: vv.id("users"),
    message: tables.messages.validator,
    parts: v.array(
      v.object({
        ...tables.parts.validator.fields,
        messageId: v.optional(vv.id("messages")),
      })
    ),
  },
  returns: v.object({
    messageId: vv.id("messages"),
    partIds: v.array(vv.id("parts")),
    credits: v.number(),
    newBalance: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId, message, parts } = args;

    // Auth is not propagated to scheduled functions — user is looked up by the
    // userId the action captured from its own auth context before scheduling.
    const appUser = await ctx.db.get("users", userId);
    if (!appUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found.",
      });
    }

    await verifyChatOwnership(ctx, message.chatId, appUser._id);

    if (message.identifier) {
      await deleteMessageByIdentifier(ctx, message.chatId, message.identifier);
    }

    let credits = 0;
    let newBalance = appUser.credits;

    if (message.modelId) {
      credits = getModelCreditCost(message.modelId);
      newBalance = appUser.credits - credits;
    }

    const messageId = await ctx.db.insert("messages", {
      chatId: message.chatId,
      role: message.role,
      identifier: message.identifier,
      modelId: message.modelId,
      inputTokens: message.inputTokens,
      outputTokens: message.outputTokens,
      totalTokens: message.totalTokens,
      credits: message.modelId ? credits : undefined,
    });

    const partIds = await insertParts(ctx, messageId, parts);

    if (message.modelId) {
      await ctx.db.patch("users", appUser._id, {
        credits: newBalance,
      });

      await ctx.db.insert("creditTransactions", {
        userId: appUser._id,
        amount: -credits,
        type: "usage",
        balanceAfter: newBalance,
        metadata: {
          chatId: message.chatId,
          messageId,
          modelId: message.modelId,
          inputTokens: message.inputTokens,
          outputTokens: message.outputTokens,
          totalTokens: message.totalTokens,
        },
      });
    }

    return { messageId, partIds, credits, newBalance };
  },
});
