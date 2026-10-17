import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  SETTLE_GRACE,
  START_DEADLINE,
  SWEEP_INTERVAL,
  TURN_DEADLINE,
} from "@repo/backend/confect/nina/deadline";
import type { NinaSweepResume } from "@repo/backend/confect/nina/lifecycle.spec";
import { sinceAdmission } from "@repo/backend/confect/nina/timing";
import { Array as Arr, Clock, Duration, Effect } from "effect";

/** How many open turns one sweep call reads before the next call continues. */
const SWEEP_PAGE = 50;

/** The database I/O that sealing old turns may cost in one day, in bytes (ADR 0024). */
const SEAL_DAILY_BYTES = 1_000_000_000;

/** How many sweep runs a day, counted from the cadence the sweep runs at. */
const SWEEP_RUNS_PER_DAY =
  Duration.toMillis(Duration.days(1)) / Duration.toMillis(SWEEP_INTERVAL);

/**
 * The bytes of database I/O that one sweep run may spend on sealing old turns: the
 * day's allowance divided by the runs of a day (ADR 0024). The drain seals the oldest
 * settled turns within it (`sealed/drain.ts`).
 */
export const SEAL_BYTES_PER_SWEEP = SEAL_DAILY_BYTES / SWEEP_RUNS_PER_DAY;

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
 * Schedules the drain that seals the settled turns still holding plain rows, oldest
 * first, within this run's byte budget (ADR 0024). The drain is an action, so each
 * seal is its own transaction. A turn whose seal fails is counted on the turn and is
 * tried again by a later run, until the sweep holds it. A turn that the seal skips
 * on purpose is held too, so the drain never takes it again.
 */
const scheduleSeals = Effect.fn("nina.sweep.seals")(function* () {
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.nina.sealed.drain,
    { budget: SEAL_BYTES_PER_SWEEP }
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
 * The first call of a sweep also schedules the drain of the settled turns that still
 * hold plain rows, within the byte budget of the run (`scheduleSeals`).
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
