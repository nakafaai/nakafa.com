import { abortStream } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import { Array as Arr, Effect } from "effect";

const settlementFailure = () =>
  new NinaTurnError({
    code: "NINA_WRITE_FAILED",
    message: "Unable to settle this Nina response.",
  });

/**
 * True once the Agent journal holds this turn's final answer. The newest row is
 * read opened, because the text of a sealed answer is in its sealed content.
 */
export const answered = Effect.fn("nina.journal.answered")(function* (
  turn: NinaTurnsDoc
) {
  const ctx = yield* MutationCtx;
  const messages = yield* readThread(ctx, {
    owner: turn.userId,
    paginationOpts: { cursor: null, numItems: 1 },
    threadId: turn.threadId,
  }).pipe(Effect.mapError(settlementFailure));
  const final = messages.page[0];
  return (
    final?.order === turn.order &&
    final.status === "success" &&
    final.message?.role === "assistant" &&
    final.finishReason === "stop" &&
    (typeof final.message.content === "string"
      ? final.message.content.trim().length > 0
      : Arr.some(
          final.message.content,
          (part) => part.type === "text" && part.text.trim().length > 0
        ))
  );
});

/**
 * Cuts the turn off in the Agent journal: its stream stops taking output and
 * its prompt is marked failed. Agent propagates a failed prompt to any output
 * committed afterwards, so a late provider result can never become success
 * while the user's text stays.
 */
export const cutOff = Effect.fn("nina.journal.cutOff")(function* (
  turn: NinaTurnsDoc,
  reason: "failed" | "cancelled"
) {
  const ctx = yield* MutationCtx;
  yield* Effect.tryPromise({
    try: () =>
      abortStream(ctx, components.nina, {
        threadId: turn.threadId,
        order: turn.order,
        reason,
      }),
    catch: settlementFailure,
  });
  yield* Effect.tryPromise({
    try: () =>
      ctx.runMutation(components.nina.messages.updateMessage, {
        messageId: turn.promptMessageId,
        patch: { status: "failed", error: reason },
      }),
    catch: settlementFailure,
  });
});
