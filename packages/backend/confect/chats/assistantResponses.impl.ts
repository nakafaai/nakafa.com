import { FunctionImpl, GroupImpl } from "@confect/server";
import { ModelIdSchema } from "@repo/ai/config/model";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { requireChatOwner } from "@repo/backend/confect/chats/access/owner";
import spec from "@repo/backend/confect/chats/assistantResponses.spec";
import {
  insertParts,
  rewriteTranscript,
} from "@repo/backend/confect/chats/transcript/write";
import {
  readChatTurn,
  refundChatTurn,
} from "@repo/backend/confect/chats/turns/impl";
import type { CreditTransactionMetadata } from "@repo/backend/confect/credits/schema";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer, Struct } from "effect";

/**
 * Persists an assistant message and settles its credits atomically.
 *
 * A held turn completes its existing debit exactly once. Closed turns and
 * account deletion make delayed retries a no-op.
 */
const saveAssistantResponse = FunctionImpl.make(
  databaseSchema,
  spec,
  "saveAssistantResponse",
  Effect.fn("chats.assistantResponses.saveAssistantResponse")(function* (args) {
    const ctx = yield* MutationCtxService;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const { userId, message, parts } = args;
    const appUser = yield* reader
      .table("users")
      .get(userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!appUser || isAccountDeletionPending(appUser)) {
      return null;
    }
    const turn = yield* readChatTurn(
      ctx,
      args.turnId,
      appUser._id,
      message.modelId
    );
    if (!turn) {
      return null;
    }
    yield* requireChatOwner(message.chatId, appUser._id);
    yield* rewriteTranscript(message.chatId, message.identifier, "assistant");
    const modelId = ModelIdSchema.make(turn.modelId);
    const messageId = yield* writer
      .table("messages")
      .insert({
        chatId: message.chatId,
        role: message.role,
        identifier: message.identifier,
        modelId,
        ...Struct.pick(message, ["inputTokens"]),
        ...Struct.pick(message, ["outputTokens"]),
        ...Struct.pick(message, ["totalTokens"]),
        credits: turn.credits,
        generationStatus: "complete",
        ...Struct.pick(message, ["ninaContextSnapshot"]),
        ...Struct.pick(message, ["ninaContextTransition"]),
      })
      .pipe(Effect.orDie);
    const partIds = yield* insertParts(messageId, parts);
    const usageMetadata: CreditTransactionMetadata = {
      chatId: message.chatId,
      messageId,
      modelId,
      ...Struct.pick(message, ["inputTokens", "outputTokens", "totalTokens"]),
    };
    yield* writer
      .table("creditTransactions")
      .patch(turn.transactionId, {
        metadata: usageMetadata,
      })
      .pipe(Effect.orDie);
    yield* writer.table("chatTurns").delete(turn._id);
    return {
      messageId,
      partIds,
      credits: turn.credits,
      newBalance: appUser.credits,
    };
  })
);
const saveAssistantFailure = FunctionImpl.make(
  databaseSchema,
  spec,
  "saveAssistantFailure",
  Effect.fn("chats.assistantResponses.saveAssistantFailure")(function* (args) {
    const ctx = yield* MutationCtxService;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const { userId, message } = args;
    const appUser = yield* reader
      .table("users")
      .get(userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!appUser || isAccountDeletionPending(appUser)) {
      return null;
    }
    const turn = yield* readChatTurn(
      ctx,
      args.turnId,
      appUser._id,
      message.modelId
    );
    if (!turn) {
      return null;
    }
    yield* requireChatOwner(message.chatId, appUser._id);
    yield* rewriteTranscript(message.chatId, message.identifier, "assistant");
    const messageId = yield* writer
      .table("messages")
      .insert({
        chatId: message.chatId,
        role: "assistant",
        identifier: message.identifier,
        modelId: message.modelId,
        generationStatus: "failed",
        generationErrorCode: message.generationErrorCode,
      })
      .pipe(Effect.orDie);
    yield* refundChatTurn(ctx, turn);
    return {
      messageId,
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(saveAssistantResponse),
  Layer.provide(saveAssistantFailure),
  Layer.provide(atomic),
  GroupImpl.finalize
);
