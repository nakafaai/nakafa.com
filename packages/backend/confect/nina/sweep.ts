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
 * How long a turn may stay queued or running: the chat call's total budget plus
 * one minute for the claim, the last save and the settlement around it. A turn
 * past it can no longer finish on its own.
 */
export const TURN_DEADLINE = Duration.sum(
  Duration.millis(purposes.chat.timeout.totalMs),
  Duration.minutes(1)
);

/** How many open turns one sweep call reads before the next call continues. */
const SWEEP_PAGE = 50;

/** A running turn counts from the start of its run, a queued one from admission. */
function openSince(turn: NinaTurnsDoc) {
  return turn.state.status === "running"
    ? turn.state.startedAt
    : turn._creationTime;
}

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
  const overdue = Arr.filter(page.page, (turn) => openSince(turn) < before);
  if (Arr.isReadonlyArrayNonEmpty(overdue)) {
    yield* Effect.logWarning("Nina turns stayed open past their deadline", {
      count: overdue.length,
    });
  }
  yield* Effect.forEach(
    overdue,
    (turn) =>
      scheduler.runAfter(
        Duration.zero,
        refs.internal.nina.lifecycle.recover,
        { turnId: turn._id, failure: "response-timeout" }
      ),
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
