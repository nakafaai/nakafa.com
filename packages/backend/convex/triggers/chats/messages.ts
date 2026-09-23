import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Struct } from "effect";

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

  const chat = await ctx.db.get("chats", message.chatId);
  if (!chat) {
    return;
  }

  const user = await ctx.db.get("users", chat.userId);
  if (!user || isAccountDeletionPending(user)) {
    return;
  }

  if (message.role === "user") {
    await runConvexProgram(
      captureProductEvent(ctx, {
        distinctId: chat.userId,
        event: {
          name: "chat message sent",
          properties: {
            chat_type: chat.type,
            ...Struct.renameKeys(Struct.pick(message, ["modelId"]), {
              modelId: "model_id",
            }),
          },
        },
        timestamp: new Date(message._creationTime),
      })
    );
    return;
  }

  if (message.role !== "assistant") {
    return;
  }

  if (message.generationStatus === "failed") {
    if (!message.generationErrorCode) {
      return;
    }

    await runConvexProgram(
      captureProductEvent(ctx, {
        distinctId: chat.userId,
        event: {
          name: "chat response failed",
          properties: {
            chat_type: chat.type,
            error_code: message.generationErrorCode,
            ...Struct.renameKeys(Struct.pick(message, ["modelId"]), {
              modelId: "model_id",
            }),
          },
        },
        timestamp: new Date(message._creationTime),
      })
    );
    return;
  }

  await runConvexProgram(
    captureProductEvent(ctx, {
      distinctId: chat.userId,
      event: {
        name: "chat response completed",
        properties: {
          chat_type: chat.type,
          ...Struct.pick(message, ["credits"]),
          ...Struct.renameKeys(Struct.pick(message, ["inputTokens"]), {
            inputTokens: "input_tokens",
          }),
          ...Struct.renameKeys(Struct.pick(message, ["modelId"]), {
            modelId: "model_id",
          }),
          ...Struct.renameKeys(Struct.pick(message, ["outputTokens"]), {
            outputTokens: "output_tokens",
          }),
          ...Struct.renameKeys(Struct.pick(message, ["totalTokens"]), {
            totalTokens: "total_tokens",
          }),
        },
      },
      timestamp: new Date(message._creationTime),
    })
  );
}
