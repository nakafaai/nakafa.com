import type { Docs, NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { creditsCharged } from "@repo/backend/confect/credits/constants";
import { activeTurns } from "@repo/backend/confect/nina/capacity";
import type {
  NinaFailureReason,
  NinaHistoryCost,
  NinaTurnTiming,
} from "@repo/backend/confect/nina/contract/turn";
import { refundCredits } from "@repo/backend/confect/nina/credits/ledger";
import { TURN_DEADLINE } from "@repo/backend/confect/nina/deadline";
import { reportLostRun } from "@repo/backend/confect/nina/diagnostics";
import { answered, cutOff } from "@repo/backend/confect/nina/journal";
import { sinceAdmission } from "@repo/backend/confect/nina/timing";
import { NinaSettledTurn } from "@repo/backend/confect/nina/turns.spec";
import { Array as Arr, Clock, Duration, Effect, Result, Schema } from "effect";

/**
 * Writes the end of an active turn in the transaction that decided it: an
 * unanswered turn gets its hold back, its chat is freed, and the turn is
 * replaced by its settled form. `failure` is the reason a failed turn stores.
 *
 * A turn that ends without an answer after its deadline lost its run, because
 * no live run is open that long (`TURN_DEADLINE`), unless the learner stopped
 * it or its own run came back to end it. The sweep, the end of the settlement
 * grace (`abandonTurn`) and the delete of a chat end such a turn, and this
 * reports the loss, whichever status the ending stores. Only an active turn is
 * closed, so it is reported once, however many sweeps and late results reach
 * the turn. A turn the learner stopped has `cancelRequestedAt`, and one that
 * holds an answer ends as complete: neither is a loss. Only the exit of the
 * run itself passes `timing`, which only it knows, and a run reports its own
 * failure (`reportFailure`), however late it fails.
 */
export const closeTurn = Effect.fn("nina.settlement.close")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>,
  status: "complete" | "failed" | "cancelled",
  failure?: typeof NinaFailureReason.Type,
  timing?: typeof NinaTurnTiming.Type,
  history?: typeof NinaHistoryCost.Type
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  // An answer costs what its model calls reported, and the rest of the hold comes back.
  // A turn that did not answer costs nothing, so all of its hold comes back.
  const charged =
    status === "complete" ? creditsCharged(turn.usage, turn.credits) : 0;
  yield* refundCredits(turn, turn._id, turn.credits - charged);
  // The hold's first usage row may name the pack it drew from, so its metadata keeps that.
  const holdUsage = yield* reader
    .table("creditTransactions")
    .get(turn.transactionId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  yield* writer
    .table("creditTransactions")
    .patch(turn.transactionId, {
      metadata: {
        ...holdUsage?.metadata,
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
  const reason = failure ?? "interrupted";
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
    // Only an answered turn is folded into the summary, so only it keeps the cost.
    ...(history && status === "complete" ? { history } : {}),
    state:
      status === "failed"
        ? { status, finishedAt, reason }
        : { status, finishedAt },
  }).pipe(Effect.orDie);
  yield* writer
    .table("ninaTurns")
    .replace(turn._id, settled)
    .pipe(Effect.orDie);
  // The seal runs at once, as the sweep also seals a turn it finds unsealed (ADR
  // 0024). A failed seal leaves the turn plain until the next sweep, and never
  // blocks the refund or the chat, which are written above.
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.nina.sealed.seal,
    { turnId: turn._id }
  );
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
                credits: charged,
                input_tokens: input,
                output_tokens: output,
                total_tokens: input + output,
              },
            }
          : {
              name: "chat response failed",
              properties: {
                chat_type: chat.type,
                error_code: reason,
              },
            },
      timestamp: finishedAt,
    });
  }
  const openMs = sinceAdmission(turn, settledAt);
  if (
    status !== "complete" &&
    turn.cancelRequestedAt === undefined &&
    timing === undefined &&
    openMs > Duration.toMillis(TURN_DEADLINE)
  ) {
    yield* reportLostRun(turn, reason, openMs);
  }
});

/**
 * Inspect the Agent journal and settle its existing hold in the same
 * transaction. Only an active turn is passed in. Every caller reads the turn in
 * the transaction that settles it and leaves a settled one alone, so a turn
 * settles once and its hold is never paid back twice.
 */
export const settleTurn = Effect.fn("nina.settlement")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>,
  interrupted: "failed" | "cancelled",
  failure?: typeof NinaFailureReason.Type,
  timing?: typeof NinaTurnTiming.Type,
  history?: typeof NinaHistoryCost.Type
) {
  const completed = yield* answered(turn);
  if (!completed) {
    yield* cutOff(turn, interrupted);
  }
  yield* closeTurn(
    turn,
    completed ? "complete" : interrupted,
    failure,
    timing,
    history
  );
});

/**
 * How long a stopped turn waits for its run to exit before it settles anyway.
 * A live run checks its turn every two seconds (`HALT_POLL`) and ends its
 * generation when it finds the turn stopped, so a turn that is still open long
 * after the stop has no run left to wait for.
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
 * them, and the caller carries on with that copy. It also returns the
 * learner's newest open turns (`activeTurns`) as the settlements left them, so
 * the caller counts them without reading them again. They are read again only
 * when a turn settled, because an older turn may then be among the newest.
 */
export const settleStopped = Effect.fn("nina.settlement.stopped")(function* (
  learner: Docs["users"]
) {
  const open = yield* activeTurns(learner._id);
  const stopped = Arr.filterMap(open, (turn) =>
    turn.phase === "active" && turn.cancelRequestedAt !== undefined
      ? Result.succeed(turn)
      : Result.failVoid
  );
  if (!Arr.isReadonlyArrayNonEmpty(stopped)) {
    return { learner, open };
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
  return {
    learner: yield* (yield* DatabaseReader)
      .table("users")
      .get(learner._id)
      .pipe(Effect.orDie),
    open: yield* activeTurns(learner._id),
  };
});
