import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Captures chat product events after user and assistant messages are persisted.
 */
export async function messagesHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "messages">
) {
  const message = change.newDoc;

  if (change.operation !== "insert" || !message) {
    return;
  }

  const chat = await ctx.db.get(message.chatId);
  if (!chat) {
    return;
  }

  if (message.role === "user") {
    await captureProductEvent(ctx, {
      distinctId: chat.userId,
      event: {
        name: "chat message sent",
        properties: {
          chat_type: chat.type,
          model_id: message.modelId,
        },
      },
      timestamp: new Date(message._creationTime),
    });
    return;
  }

  if (message.role !== "assistant") {
    return;
  }

  if (message.generationStatus === "failed") {
    if (!message.generationErrorCode) {
      return;
    }

    await captureProductEvent(ctx, {
      distinctId: chat.userId,
      event: {
        name: "chat response failed",
        properties: {
          chat_type: chat.type,
          error_code: message.generationErrorCode,
          model_id: message.modelId,
        },
      },
      timestamp: new Date(message._creationTime),
    });
    return;
  }

  await captureProductEvent(ctx, {
    distinctId: chat.userId,
    event: {
      name: "chat response completed",
      properties: {
        chat_type: chat.type,
        credits: message.credits,
        input_tokens: message.inputTokens,
        model_id: message.modelId,
        output_tokens: message.outputTokens,
        total_tokens: message.totalTokens,
      },
    },
    timestamp: new Date(message._creationTime),
  });
}
