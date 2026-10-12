import type { Docs, NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { activeTurns } from "@repo/backend/confect/nina/capacity";
import type {
  NinaFailureReason,
  NinaTurnTiming,
} from "@repo/backend/confect/nina/contract/turn";
import { refundCredits } from "@repo/backend/confect/nina/credits/ledger";
import { answered, cutOff } from "@repo/backend/confect/nina/journal";
import { NinaSettledTurn } from "@repo/backend/confect/nina/turns.spec";
import { Array as Arr, Clock, Duration, Effect, Schema } from "effect";

/**
 * Writes the end of an active turn in the transaction that decided it: an
 * unanswered turn gets its hold back, its chat is freed, and the turn is
 * replaced by its settled form. `failure` is the reason a failed turn stores.
 */
export const closeTurn = Effect.fn("nina.settlement.close")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>,
  status: "complete" | "failed" | "cancelled",
  failure?: typeof NinaFailureReason.Type,
  timing?: typeof NinaTurnTiming.Type
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  if (status !== "complete") {
    yield* refundCredits(turn, turn._id);
  }
  yield* writer
    .table("creditTransactions")
    .patch(turn.transactionId, {
      metadata: {
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
  const settledAt = yield* Clock.currentTimeMillis;
  // A turn the learner stopped finished when they stopped it, however late it
  // settles, so the time the page already shows does not move.
  const finishedAt =
    status === "cancelled" ? (turn.cancelRequestedAt ?? settledAt) : settledAt;
  const input = Arr.reduce(
    turn.usage,
    0,
    (total, usage) => total + usage.input
  );
  const output = Arr.reduce(
    turn.usage,
    0,
    (total, usage) => total + usage.output
  );
  const settled = yield* Schema.decodeEffect(NinaSettledTurn)({
    ...turn,
    phase: "settled",
    tokens: { input, output, total: input + output },
    // The stages the run reached join the claim the turn already stores.
    ...(timing ? { timing: { ...turn.timing, ...timing } } : {}),
    state:
      status === "failed"
        ? { status, finishedAt, reason: failure ?? "interrupted" }
        : { status, finishedAt },
  }).pipe(Effect.orDie);
  yield* writer
    .table("ninaTurns")
    .replace(turn._id, settled)
    .pipe(Effect.orDie);
  if (status === "complete") {
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
                error_code: failure ?? "interrupted",
              },
            },
      timestamp: finishedAt,
    });
  }
});

/**
 * Inspect the Agent journal and settle its existing hold in the same
 * transaction. Only an active turn settles, so a second settlement of the same
 * turn changes nothing and never refunds twice.
 */
export const settleTurn = Effect.fn("nina.settlement")(function* (
  turn: NinaTurnsDoc,
  interrupted: "failed" | "cancelled",
  failure?: typeof NinaFailureReason.Type,
  timing?: typeof NinaTurnTiming.Type
) {
  if (turn.phase !== "active") {
    return;
  }
  const completed = yield* answered(turn);
  if (!completed) {
    yield* cutOff(turn, interrupted);
  }
  yield* closeTurn(turn, completed ? "complete" : interrupted, failure, timing);
});

/**
 * How long a stopped turn waits for its run to exit before it settles anyway.
 * A live run checks its turn every second and ends its generation when it finds
 * the turn stopped, so a turn that is still open long after the stop has no run
 * left to wait for.
 */
export const STOP_GRACE = Duration.seconds(30);

/**
 * Asks the run of a running turn to stop. The stream is cut off and the request
 * is stored, and the learner sees the turn as cancelled at once. The turn
 * itself settles, which pays its credits back and unlocks its chat, at the
 * first of three moments: its run exits, `STOP_GRACE` passes for a run that is
 * gone, or the learner sends their next prompt in any chat (`settleStopped`).
 * Whichever comes first, it settles as cancelled at the time of the stop. An
 * answer that is already saved wins the race and settles at once, with no
 * refund.
 */
export const stopTurn = Effect.fn("nina.settlement.stop")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>
) {
  if (turn.cancelRequestedAt !== undefined) {
    return;
  }
  if (yield* answered(turn)) {
    return yield* settleTurn(turn, "cancelled");
  }
  yield* cutOff(turn, "cancelled");
  yield* (yield* DatabaseWriter)
    .table("ninaTurns")
    .patch(turn._id, { cancelRequestedAt: yield* Clock.currentTimeMillis })
    .pipe(Effect.orDie);
  yield* (yield* Scheduler).runAfter(
    STOP_GRACE,
    refs.internal.nina.lifecycle.recover,
    { turnId: turn._id }
  );
});

/**
 * Settles every turn the learner stopped, in any chat, so their next prompt
 * does not wait for runs the page shows as finished. Until a stopped turn
 * settles it would keep its chat busy, count toward the open-turn limit and
 * hold its credits. `stopTurn` already cut its stream off, so no late output
 * can be saved and the refund is the one the run's exit would give a moment
 * later. A turn that was not stopped is left as it is.
 *
 * A stopped turn whose journal cannot be read or cut off is left as it is and
 * logged with its id, and the others still settle. The failure belongs to that
 * turn's own thread, so it must not refuse a prompt in another chat. Its own
 * chat stays busy, as for any turn that is still open, until a later try
 * settles it or the sweep ends it (`abandonTurn`). Until its deadline passes it
 * also counts toward the open-turn limit (`requireOpenCapacity`). Only a
 * failure of the journal is skipped. Its steps come before the settlement
 * writes its own rows, and the stop already ran them once. A failure of the
 * refund still fails the prompt, because the writes of a half-made refund would
 * otherwise commit with it.
 *
 * The refund changes the balance, so a hold taken from the copy the caller
 * started with would overwrite it. Returns the learner as the settlements left
 * them, and the caller carries on with that copy.
 */
export const settleStopped = Effect.fn("nina.settlement.stopped")(function* (
  learner: Docs["users"]
) {
  const stopped = Arr.filter(
    yield* activeTurns(learner._id),
    (turn) => turn.phase === "active" && turn.cancelRequestedAt !== undefined
  );
  if (!Arr.isReadonlyArrayNonEmpty(stopped)) {
    return learner;
  }
  yield* Effect.forEach(
    stopped,
    (turn) =>
      settleTurn(turn, "cancelled").pipe(
        Effect.catchTag("NinaTurnError", () =>
          Effect.logWarning("Nina could not settle a stopped turn", {
            turnId: turn._id,
          })
        )
      ),
    { discard: true }
  );
  return yield* (yield* DatabaseReader)
    .table("users")
    .get(learner._id)
    .pipe(Effect.orDie);
});
