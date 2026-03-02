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
import { mutation } from "@repo/backend/convex/functions";
import {
  requireAuth,
  requireAuthWithSession,
} from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";

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
      title: args.title || DEFAULT_TITLE,
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
 * Save a user message with parts.
 * If identifier exists, deletes that message (and all subsequent messages) before inserting.
 * This ensures one message per identifier, but creates a new _id each time.
 * Parts messageId is omitted - set internally after message creation.
 * Only the chat owner can add messages.
 */
export const saveMessage = mutation({
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
    await verifyChatOwnership(ctx, message.chatId, user.appUser._id);

    // Delete existing message if identifier exists (for replacement/upsert)
    if (message.identifier) {
      await deleteMessageByIdentifier(ctx, message.chatId, message.identifier);
    }

    // Create message
    // Note: modelId is stored server-side for security (credit calculation)
    const messageId = await ctx.db.insert("messages", {
      chatId: message.chatId,
      role: message.role,
      identifier: message.identifier,
      modelId: message.modelId,
    });

    // Insert parts for the message
    const partIds = await insertParts(ctx, messageId, parts);

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
      title: args.title || DEFAULT_TITLE,
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

    // Insert parts for the message
    const partIds = await insertParts(ctx, messageId, args.parts);

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

/**
 * Save an assistant response with parts and deduct credits atomically.
 * Handles both message persistence and credit deduction in a single operation.
 * Security: modelId is read from the stored message, not from client arguments.
 * Token counts (inputTokens, outputTokens, totalTokens) should be passed in the message object.
 */
export const saveAssistantResponse = mutation({
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
    creditsUsed: v.number(),
    newBalance: v.number(),
  }),
  handler: async (ctx, args) => {
    const { message, parts } = args;

    // Authorization check
    const user = await requireAuth(ctx);
    await verifyChatOwnership(ctx, message.chatId, user.appUser._id);

    // Delete existing message if identifier exists (for replacement/upsert)
    if (message.identifier) {
      await deleteMessageByIdentifier(ctx, message.chatId, message.identifier);
    }

    // Calculate credits before insert
    // Debt system: Allow negative balances for better UX
    // Users can continue chatting even with insufficient credits
    let creditsUsed = 0;
    let newBalance = user.appUser.credits;

    if (message.modelId) {
      creditsUsed = getModelCreditCost(message.modelId);
      newBalance = user.appUser.credits - creditsUsed;
      // No longer throwing error for negative balance - debt is allowed
    }

    // Create message with ALL data in single insert
    // Convex best practice: Insert all fields at once, avoid unnecessary patch
    // Reference: https://docs.convex.dev/database/writing-data#inserting-new-documents
    const messageId = await ctx.db.insert("messages", {
      chatId: message.chatId,
      role: message.role,
      identifier: message.identifier,
      modelId: message.modelId,
      inputTokens: message.inputTokens,
      outputTokens: message.outputTokens,
      totalTokens: message.totalTokens,
      creditsUsed: message.modelId ? creditsUsed : undefined,
    });

    // Insert parts for the message
    const partIds = await insertParts(ctx, messageId, parts);

    // Deduct credits if modelId is provided
    if (message.modelId) {
      // Deduct credits from user
      await ctx.db.patch("users", user.appUser._id, {
        credits: newBalance,
      });

      // Create transaction record
      await ctx.db.insert("creditTransactions", {
        userId: user.appUser._id,
        amount: -creditsUsed,
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

    return { messageId, partIds, creditsUsed, newBalance };
  },
});
