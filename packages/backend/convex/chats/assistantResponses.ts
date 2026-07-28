import { ModelIdSchema } from "@repo/ai/config/model";
import {
  deleteExistingResponseByIdentifier,
  getAssistantCreditUsage,
} from "@repo/backend/convex/chats/assistantResponses/impl";
import {
  insertParts,
  verifyChatOwnership,
} from "@repo/backend/convex/chats/helpers";
import tables, {
  messageGenerationErrorCodeValidator,
  modelIdValueValidator,
} from "@repo/backend/convex/chats/schema";
import type { CreditTransactionMetadata } from "@repo/backend/convex/credits/schema";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Persists an assistant message with parts and deducts credits atomically.
 *
 * Credits are deducted after streaming. A deleted-account tombstone turns a
 * previously scheduled write into an idempotent no-op.
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
  returns: v.union(
    v.null(),
    v.object({
      messageId: vv.id("messages"),
      partIds: v.array(vv.id("messageParts")),
      credits: v.number(),
      newBalance: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const { userId, message, parts } = args;
    const appUser = await ctx.db.get("users", userId);

    if (!appUser || appUser.deletedAt !== undefined) {
      return null;
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

/** Persists one failed assistant response unless account deletion has started. */
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
  returns: v.union(
    v.null(),
    v.object({
      messageId: vv.id("messages"),
    })
  ),
  handler: async (ctx, args) => {
    const { userId, message } = args;
    const appUser = await ctx.db.get("users", userId);

    if (!appUser || appUser.deletedAt !== undefined) {
      return null;
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
