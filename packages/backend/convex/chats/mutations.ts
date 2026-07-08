import { ModelIdSchema } from "@repo/ai/config/model";
import { DEFAULT_TITLE } from "@repo/ai/features/constants";
import {
  deleteExistingResponseByIdentifier,
  getAssistantCreditUsage,
} from "@repo/backend/convex/chats/assistantResponses/impl";
import {
  deleteMessageBatchFromPoint,
  getMessageByIdentifier,
  insertParts,
  verifyChatOwnership,
} from "@repo/backend/convex/chats/helpers";
import tables, {
  chatTypeValidator,
  chatVisibilityValidator,
  messageGenerationErrorCodeValidator,
  modelIdValueValidator,
} from "@repo/backend/convex/chats/schema";
import type { CreditTransactionMetadata } from "@repo/backend/convex/credits/schema";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
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
    const user = await requireAuth(ctx);

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
        message: "You do not have permission to update the chat visibility.",
      });
    }

    await ctx.db.patch("chats", chat._id, { visibility: args.visibility });

    return chat._id;
  },
});

/** Persist one user message and its parts, atomically replacing a rewrite tail. */
export const saveMessage = mutation({
  args: {
    message: tables.messages.validator,
    parts: v.array(
      v.object({
        ...tables.messageParts.validator.fields,
        messageId: v.optional(vv.id("messages")),
      })
    ),
  },
  returns: v.object({
    messageId: vv.id("messages"),
    partIds: v.array(vv.id("messageParts")),
  }),
  handler: async (ctx, args) => {
    const { message, parts } = args;
    const user = await requireAuth(ctx);

    await verifyChatOwnership(ctx, message.chatId, user.appUser._id);

    const existingMessage = await getMessageByIdentifier(
      ctx,
      message.chatId,
      message.identifier
    );

    if (existingMessage) {
      const deleteResult = await deleteMessageBatchFromPoint(
        ctx,
        message.chatId,
        existingMessage._creationTime
      );

      if (deleteResult.hasMore) {
        throw new ConvexError({
          code: "CHAT_USER_MESSAGE_REWRITE_EXCEEDED",
          message: "User message rewrite exceeded the supported batch size.",
        });
      }
    }

    // modelId stored server-side so clients cannot spoof credit calculations
    const messageId = await ctx.db.insert("messages", {
      chatId: message.chatId,
      role: message.role,
      identifier: message.identifier,
      modelId: message.modelId,
      ninaContextSnapshot: message.ninaContextSnapshot,
      ninaContextTransition: message.ninaContextTransition,
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
        ...tables.messageParts.validator.fields,
        messageId: v.optional(vv.id("messages")),
      })
    ),
  },
  returns: v.object({
    chatId: vv.id("chats"),
    messageId: vv.id("messages"),
    partIds: v.array(vv.id("messageParts")),
  }),
  handler: async (ctx, args) => {
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
      modelId: args.message.modelId,
      ninaContextSnapshot: args.message.ninaContextSnapshot,
      ninaContextTransition: args.message.ninaContextTransition,
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
        ...tables.messageParts.validator.fields,
        messageId: v.optional(vv.id("messages")),
      })
    ),
  },
  returns: v.object({
    messageId: vv.id("messages"),
    partIds: v.array(vv.id("messageParts")),
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

    await deleteExistingResponseByIdentifier(
      ctx,
      message.chatId,
      message.identifier
    );

    const modelId = message.modelId
      ? ModelIdSchema.make(message.modelId)
      : undefined;
    const creditUsage = await getAssistantCreditUsage(ctx, appUser, modelId);

    const messageId = await ctx.db.insert("messages", {
      chatId: message.chatId,
      role: message.role,
      identifier: message.identifier,
      modelId: message.modelId,
      inputTokens: message.inputTokens,
      outputTokens: message.outputTokens,
      totalTokens: message.totalTokens,
      credits: creditUsage?.credits,
      generationStatus: "complete",
      ninaContextSnapshot: message.ninaContextSnapshot,
      ninaContextTransition: message.ninaContextTransition,
    });

    const partIds = await insertParts(ctx, messageId, parts);

    if (!(modelId && creditUsage)) {
      return {
        messageId,
        partIds,
        credits: 0,
        newBalance: appUser.credits,
      };
    }

    await ctx.db.patch("users", appUser._id, {
      credits: creditUsage.newBalance,
      creditsResetAt: creditUsage.nextResetTimestamp,
    });

    if (creditUsage.resetGrant) {
      await ctx.db.insert("creditTransactions", {
        userId: appUser._id,
        ...creditUsage.resetGrant,
      });
    }

    const usageMetadata: CreditTransactionMetadata = {
      chatId: message.chatId,
      messageId,
      modelId,
    };

    if (message.inputTokens !== undefined) {
      usageMetadata.inputTokens = message.inputTokens;
    }

    if (message.outputTokens !== undefined) {
      usageMetadata.outputTokens = message.outputTokens;
    }

    if (message.totalTokens !== undefined) {
      usageMetadata.totalTokens = message.totalTokens;
    }

    await ctx.db.insert("creditTransactions", {
      userId: appUser._id,
      amount: -creditUsage.credits,
      type: "usage",
      balanceAfter: creditUsage.newBalance,
      metadata: usageMetadata,
    });

    return {
      messageId,
      partIds,
      credits: creditUsage.credits,
      newBalance: creditUsage.newBalance,
    };
  },
});

/**
 * Persists one failed assistant response so refresh never hides stream failure.
 *
 * @see https://docs.convex.dev/functions/internal-functions
 */
export const saveAssistantFailure = internalMutation({
  args: {
    userId: vv.id("users"),
    message: v.object({
      chatId: vv.id("chats"),
      identifier: v.string(),
      modelId: modelIdValueValidator,
      generationErrorCode: messageGenerationErrorCodeValidator,
    }),
  },
  returns: v.object({
    messageId: vv.id("messages"),
  }),
  handler: async (ctx, args) => {
    const { userId, message } = args;

    const appUser = await ctx.db.get("users", userId);
    if (!appUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not found.",
      });
    }

    await verifyChatOwnership(ctx, message.chatId, appUser._id);
    await deleteExistingResponseByIdentifier(
      ctx,
      message.chatId,
      message.identifier
    );

    const messageId = await ctx.db.insert("messages", {
      chatId: message.chatId,
      role: "assistant",
      identifier: message.identifier,
      modelId: message.modelId,
      generationStatus: "failed",
      generationErrorCode: message.generationErrorCode,
    });

    return { messageId };
  },
});
