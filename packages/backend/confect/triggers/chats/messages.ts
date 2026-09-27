import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Effect, Struct } from "effect";

/**
 * Captures chat product events after user and assistant messages are persisted.
 */
export const messagesHandler = Effect.fn(
  "triggers.chats.messages.messagesHandler"
)(function* (
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "messages">
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const message = change.newDoc;
  if (change.operation !== "insert" || !message) {
    return;
  }
  const chat = yield* database
    .table("chats")
    .get(message.chatId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!chat) {
    return;
  }
  const user = yield* database
    .table("users")
    .get(chat.userId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!user || isAccountDeletionPending(user)) {
    return;
  }
  if (message.role === "user") {
    yield* captureProductEvent(ctx, {
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
    yield* captureProductEvent(ctx, {
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
    });
    return;
  }
  yield* captureProductEvent(ctx, {
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
  });
});
