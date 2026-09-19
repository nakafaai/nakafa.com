import { ModelIdSchema } from "@repo/ai/config/model";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { deleteExistingResponseByIdentifier } from "@repo/backend/convex/chats/assistantResponses/impl";
import {
  insertParts,
  verifyChatOwnership,
} from "@repo/backend/convex/chats/helpers";
import {
  messageGenerationErrorCodeValidator,
  modelIdValueValidator,
} from "@repo/backend/convex/chats/schema";
import tables from "@repo/backend/convex/chats/tables/schema";
import {
  readChatTurn,
  refundChatTurn,
} from "@repo/backend/convex/chats/turns/impl";
import type { CreditTransactionMetadata } from "@repo/backend/convex/credits/schema";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Persists an assistant message and settles its credits atomically.
 *
 * A held turn completes its existing debit exactly once. Closed turns and
 * account deletion make delayed retries a no-op.
 */
export const saveAssistantResponse = internalMutation({
  args: {
    userId: vv.id("users"),
    turnId: vv.id("chatTurns"),
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

    if (!appUser || isAccountDeletionPending(appUser)) {
      return null;
    }

    const turn = await runConvexProgram(
      readChatTurn(ctx, args.turnId, appUser._id, message.modelId)
    );
    if (!turn) {
      return null;
    }
    await verifyChatOwnership(ctx, message.chatId, appUser._id);
    await deleteExistingResponseByIdentifier(
      ctx,
      message.chatId,
      message.identifier
    );

    const modelId = ModelIdSchema.make(turn.modelId);
    const messageId = await ctx.db.insert("messages", {
      chatId: message.chatId,
      role: message.role,
      identifier: message.identifier,
      modelId,
      inputTokens: message.inputTokens,
      outputTokens: message.outputTokens,
      totalTokens: message.totalTokens,
      credits: turn.credits,
      generationStatus: "complete",
      ninaContextSnapshot: message.ninaContextSnapshot,
      ninaContextTransition: message.ninaContextTransition,
    });
    const partIds = await insertParts(ctx, messageId, parts);

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

    await ctx.db.patch("creditTransactions", turn.transactionId, {
      metadata: usageMetadata,
    });
    await ctx.db.delete("chatTurns", turn._id);

    return {
      messageId,
      partIds,
      credits: turn.credits,
      newBalance: appUser.credits,
    };
  },
});

/** Persists one failed assistant response unless account deletion has started. */
export const saveAssistantFailure = internalMutation({
  args: {
    userId: vv.id("users"),
    turnId: vv.id("chatTurns"),
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

    if (!appUser || isAccountDeletionPending(appUser)) {
      return null;
    }

    const turn = await runConvexProgram(
      readChatTurn(ctx, args.turnId, appUser._id, message.modelId)
    );
    if (!turn) {
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

    await runConvexProgram(refundChatTurn(ctx, turn));
    return { messageId };
  },
});
