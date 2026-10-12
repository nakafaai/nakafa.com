import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  START_DEADLINE,
  TURN_DEADLINE,
} from "@repo/backend/confect/nina/deadline";
import type { NinaSweepResume } from "@repo/backend/confect/nina/lifecycle.spec";
import { sinceAdmission } from "@repo/backend/confect/nina/timing";
import { Array as Arr, Clock, Duration, Effect } from "effect";

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
  const waited = sinceAdmission(turn, yield* Clock.currentTimeMillis);
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
