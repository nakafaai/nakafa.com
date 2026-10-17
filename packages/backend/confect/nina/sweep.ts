import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  SETTLE_GRACE,
  START_DEADLINE,
  TURN_DEADLINE,
} from "@repo/backend/confect/nina/deadline";
import type { NinaSweepResume } from "@repo/backend/confect/nina/lifecycle.spec";
import { sinceAdmission } from "@repo/backend/confect/nina/timing";
import { Array as Arr, Clock, Duration, Effect } from "effect";

/** How many open turns one sweep call reads before the next call continues. */
const SWEEP_PAGE = 50;

/**
 * How many settled turns that still hold plain rows one sweep run seals. ADR 0024
 * derives it from the measured cost of one seal of a turn with the most rows the
 * step limit allows, and from the sweep's cadence, so that sealing every old turn
 * stays under 1 GB of database I/O a day.
 */
export const SEAL_TURNS_PER_SWEEP = 1;

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
 * Schedules the seal of the settled turns that still hold plain rows, oldest first,
 * `SEAL_TURNS_PER_SWEEP` of them. A turn that the seal sealed leaves the index
 * range. A turn whose seal fails stays in it, and the next run tries it again. So
 * does a turn that the seal skips while its chat or learner is being deleted, until
 * that deletion removes the turn (ADR 0024).
 */
const scheduleSeals = Effect.fn("nina.sweep.seals")(function* () {
  const reader = yield* DatabaseReader;
  const scheduler = yield* Scheduler;
  const plain = yield* reader
    .table("ninaTurns")
    .index("by_phase_and_sealedAt", (q) =>
      q.eq("phase", "settled").eq("sealedAt", undefined)
    )
    .take(SEAL_TURNS_PER_SWEEP)
    .pipe(Effect.orDie);
  yield* Effect.forEach(
    plain,
    (turn) =>
      scheduler.runAfter(Duration.zero, refs.internal.nina.sealed.seal, {
        turnId: turn._id,
      }),
    { discard: true }
  );
});

/**
 * Settles every turn that stayed open past its deadline, whatever stopped its
 * own settlement: a crashed action, a deploy that took the run away, a lost
 * schedule or a failed write. No run is alive past the deadline, so such a
 * turn is stored as interrupted, never as a timeout. Each overdue turn gets its
 * own scheduled settlement, so one that cannot settle never blocks the others,
 * and the next sweep tries it again. Every sweep also schedules `abandon` for
 * the turn at the end of `SETTLE_GRACE`, counted from that sweep. The first one
 * to run ends a turn that every try failed to settle, and the rest find it
 * settled. A call reads one page and schedules the next while more remain.
 * The first call of a sweep also schedules the seal of a few settled turns that
 * still hold plain rows (`scheduleSeals`), so no run seals more than the bound.
 */
export const sweepTurns = Effect.fn("nina.sweep")(function* (
  resume?: typeof NinaSweepResume.Type
) {
  const reader = yield* DatabaseReader;
  const scheduler = yield* Scheduler;
  const now = yield* Clock.currentTimeMillis;
  const before = resume?.before ?? now - Duration.toMillis(TURN_DEADLINE);
  if (resume === undefined) {
    yield* scheduleSeals();
  }
  const page = yield* reader
    .table("ninaTurns")
    .index("by_phase", (q) =>
      q.eq("phase", "active").lt("_creationTime", before)
    )
    .paginate({ cursor: resume?.cursor ?? null, numItems: SWEEP_PAGE })
    .pipe(Effect.orDie);
  if (Arr.isReadonlyArrayNonEmpty(page.page)) {
    yield* Effect.logWarning("Nina turns stayed open past their deadline", {
      turnIds: Arr.map(page.page, (turn) => turn._id),
    });
  }
  yield* Effect.forEach(
    page.page,
    Effect.fn(function* (turn) {
      const turnId = turn._id;
      yield* scheduler.runAfter(
        Duration.zero,
        refs.internal.nina.lifecycle.recover,
        { turnId }
      );
      yield* scheduler.runAfter(
        SETTLE_GRACE,
        refs.internal.nina.lifecycle.abandon,
        { turnId }
      );
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
