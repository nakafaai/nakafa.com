import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { purposes } from "@repo/backend/confect/gateway/purpose";
import type { NinaSweepResume } from "@repo/backend/confect/nina/lifecycle.spec";
import { Array as Arr, Clock, Duration, Effect } from "effect";

/**
 * How long a queued turn may wait for its run to start. A run that starts
 * later could still be in its chat call when the turn's deadline passes, so
 * the claim refuses it instead.
 */
export const START_DEADLINE = Duration.seconds(30);

/**
 * How long a turn may stay open, counted from its admission: the wait for its
 * run to start, the chat call's total budget, and half a minute for the last
 * save and the settlement. A turn past it can no longer finish on its own.
 */
export const TURN_DEADLINE = Duration.sum(
  Duration.sum(START_DEADLINE, Duration.millis(purposes.chat.timeout.totalMs)),
  Duration.seconds(30)
);

/** How many open turns one sweep call reads before the next call continues. */
const SWEEP_PAGE = 50;

/**
 * True once a queued turn waited too long for its run to start. Every turn
 * therefore has one clock, its admission: a run that starts in time ends
 * before the turn's deadline, so the open-turn limit and the sweep never
 * mistake a live run for a dead one.
 */
export const startsLate = Effect.fn("nina.sweep.late")(function* (
  turn: NinaTurnsDoc
) {
  const waited = (yield* Clock.currentTimeMillis) - turn._creationTime;
  return waited > Duration.toMillis(START_DEADLINE);
});

/**
 * Settles every turn that stayed open past its deadline, whatever stopped its
 * own settlement: a crashed action, a lost schedule or a failed write. Each
 * overdue turn gets its own scheduled settlement, so one that cannot settle
 * never blocks the others, and the next sweep tries it again. A call reads one
 * page and schedules the next while more remain.
 */
export const sweepTurns = Effect.fn("nina.sweep")(function* (
  resume?: typeof NinaSweepResume.Type
) {
  const reader = yield* DatabaseReader;
  const scheduler = yield* Scheduler;
  const now = yield* Clock.currentTimeMillis;
  const before = resume?.before ?? now - Duration.toMillis(TURN_DEADLINE);
  const page = yield* reader
    .table("ninaTurns")
    .index("by_phase", (q) =>
      q.eq("phase", "active").lt("_creationTime", before)
    )
    .paginate({ cursor: resume?.cursor ?? null, numItems: SWEEP_PAGE })
    .pipe(Effect.orDie);
  if (Arr.isReadonlyArrayNonEmpty(page.page)) {
    yield* Effect.logWarning("Nina turns stayed open past their deadline", {
      count: page.page.length,
    });
  }
  yield* Effect.forEach(
    page.page,
    (turn) =>
      scheduler.runAfter(Duration.zero, refs.internal.nina.lifecycle.recover, {
        turnId: turn._id,
        failure: "response-timeout",
      }),
    { discard: true }
  );
  if (!page.isDone) {
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.nina.lifecycle.sweep,
      { resume: { before, cursor: page.continueCursor } }
    );
  }
});
