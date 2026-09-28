import { abortStream, listMessages } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { refundCredits } from "@repo/backend/confect/nina/credits/ledger";
import {
  type NinaFailureReason,
  NinaSettledTurn,
  NinaTurnError,
} from "@repo/backend/confect/nina/turns.spec";
import { Clock, Duration, Effect, Schema } from "effect";

const settlementFailure = () =>
  new NinaTurnError({
    code: "NINA_WRITE_FAILED",
    message: "Unable to settle this Nina response.",
  });

/** Inspect the Agent journal and settle its existing hold in the same transaction. */
export const settleTurn = Effect.fn("nina.settlement")(function* (
  turn: NinaTurnsDoc,
  interrupted: "failed" | "cancelled",
  failure?: typeof NinaFailureReason.Type
) {
  if (turn.phase !== "active") {
    return;
  }
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const ctx = yield* MutationCtx;
  const messages = yield* Effect.tryPromise({
    try: () =>
      listMessages(ctx, components.nina, {
        threadId: turn.threadId,
        paginationOpts: { cursor: null, numItems: 1 },
      }),
    catch: settlementFailure,
  });
  const final = messages.page[0];
  const completed =
    final?.order === turn.order &&
    final.status === "success" &&
    final.message?.role === "assistant" &&
    final.finishReason === "stop" &&
    (typeof final.message.content === "string"
      ? final.message.content.trim().length > 0
      : final.message.content.some(
          (part) => part.type === "text" && part.text.trim().length > 0
        ));
  const status = completed ? "complete" : interrupted;
  if (!completed) {
    yield* Effect.tryPromise({
      try: () =>
        abortStream(ctx, components.nina, {
          threadId: turn.threadId,
          order: turn.order,
          reason: status,
        }),
      catch: settlementFailure,
    });
    // Agent propagates a failed prompt to any output committed after cancellation.
    // Keep the user's text while preventing a late provider result becoming success.
    yield* Effect.tryPromise({
      try: () =>
        ctx.runMutation(components.nina.messages.updateMessage, {
          messageId: turn.promptMessageId,
          patch: { status: "failed", error: status },
        }),
      catch: settlementFailure,
    });
    yield* refundCredits(turn, turn._id);
  }
  yield* writer
    .table("creditTransactions")
    .patch(turn.transactionId, {
      metadata: {
        modelId: turn.modelId,
        chatId: turn.chatId,
        turnId: turn._id,
        phase: status,
      },
    })
    .pipe(Effect.orDie);
  const chat = yield* reader
    .table("chats")
    .get(turn.chatId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (chat?.activeTurnId === turn._id) {
    yield* writer
      .table("chats")
      .patch(chat._id, { activeTurnId: undefined })
      .pipe(Effect.orDie);
  }
  const finishedAt = yield* Clock.currentTimeMillis;
  const input = turn.usage.reduce((total, usage) => total + usage.input, 0);
  const output = turn.usage.reduce((total, usage) => total + usage.output, 0);
  const settled = yield* Schema.decodeEffect(NinaSettledTurn)({
    ...turn,
    phase: "settled",
    tokens: { input, output, total: input + output },
    state:
      status === "failed"
        ? { status, finishedAt, reason: failure ?? "interrupted" }
        : { status, finishedAt },
  }).pipe(Effect.orDie);
  yield* writer
    .table("ninaTurns")
    .replace(turn._id, settled)
    .pipe(Effect.orDie);
  if (completed) {
    // Settlement schedules this once, including recovery after an interrupted action.
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      refs.internal.nina.response.present,
      { turnId: turn._id }
    );
  }
  if (chat && status !== "cancelled") {
    yield* captureProductEvent({
      distinctId: turn.userId,
      event:
        status === "complete"
          ? {
              name: "chat response completed",
              properties: {
                chat_type: chat.type,
                model_id: turn.modelId,
                credits: turn.credits,
                input_tokens: input,
                output_tokens: output,
                total_tokens: input + output,
              },
            }
          : {
              name: "chat response failed",
              properties: {
                chat_type: chat.type,
                model_id: turn.modelId,
                error_code: failure ?? "interrupted",
              },
            },
      timestamp: new Date(finishedAt),
    });
  }
});
