import { DirectAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/confect/_generated/components";
import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import type { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import {
  SeatStanding,
  seatStandingOf,
} from "@repo/backend/confect/exams/sittings/standing";
import { Array as Arr, Effect, Option, Record as Rec } from "effect";

/**
 * The seats of every sitting by how they stand: one item for each attempt, keyed by its standing, in the sitting's
 * namespace. Every write is queued, so the students who enter a room in the same seconds never contend on one row: the
 * component's batch worker applies the writes one after another, and the counts read the applied snapshot, which stays
 * reactive. A write never mixes with an unqueued one, as the component requires.
 */
const roomCounts = new DirectAggregate<{
  Id: ExamAttemptsDoc["_id"];
  Key: SeatStanding;
  Namespace: ExamSittingsDoc["_id"];
}>(components.roomCounts);

/**
 * Moves one attempt's seat from how it stood to how it stands now, as a queued write, and writes nothing for a seat
 * that stays where it stood. A seat the counts do not hold yet, such as one entered before the counts existed, is
 * added where it stands now, so no backfill is needed.
 */
export const moveSeat = Effect.fn("exams.sittings.counts.move")(function* (
  attempt: Pick<ExamAttemptsDoc, "_id" | "sitting">,
  before: SeatStanding,
  after: SeatStanding
) {
  if (before === after) {
    return;
  }
  const ctx = yield* MutationCtx;
  yield* Effect.promise(() =>
    roomCounts.replaceOrInsert(
      ctx,
      { id: attempt._id, key: before, namespace: attempt.sitting },
      { key: after, namespace: attempt.sitting },
      { async: true }
    )
  );
});

/** An attempt's latest signal, by the time it was recorded, or none before its first. */
export const latestSignalOf = Effect.fn("exams.sittings.counts.latest")(
  function* (attemptId: ExamAttemptsDoc["_id"]) {
    return yield* (yield* DatabaseReader)
      .table("examSignals")
      .index(
        "by_attemptId_and_at",
        (query) => query.eq("attempt", attemptId),
        "desc"
      )
      .first()
      .pipe(Effect.orDie);
  }
);

/** Moves an attempt's seat from the state it holds to the state it takes, both read with its latest signal. */
export const moveState = Effect.fn("exams.sittings.counts.state")(function* (
  attempt: Pick<ExamAttemptsDoc, "_id" | "sitting" | "state">,
  next: typeof AttemptState.Type
) {
  const latest = Option.match(yield* latestSignalOf(attempt._id), {
    onNone: () => null,
    onSome: (signal) => signal.kind,
  });
  yield* moveSeat(
    attempt,
    seatStandingOf(attempt.state, latest),
    seatStandingOf(next, latest)
  );
});

/** Adds a new attempt's seat to its room's counts, as a queued write, standing present. */
export const addSeat = Effect.fn("exams.sittings.counts.add")(function* (
  attempt: Pick<ExamAttemptsDoc, "_id" | "sitting">
) {
  const ctx = yield* MutationCtx;
  yield* Effect.promise(() =>
    roomCounts.insertIfDoesNotExist(
      ctx,
      { id: attempt._id, key: "present", namespace: attempt.sitting },
      { async: true }
    )
  );
});

/** The seats of one sitting by standing, from the counts' applied snapshot, which stays reactive. */
export const seatCountsOf = Effect.fn("exams.sittings.counts.of")(function* (
  sittingId: ExamSittingsDoc["_id"]
) {
  const ctx = yield* QueryCtx;
  const counts = yield* Effect.promise(() =>
    roomCounts.countBatch(
      ctx,
      Arr.map(SeatStanding.literals, (standing) => ({
        bounds: {
          lower: { inclusive: true, key: standing },
          upper: { inclusive: true, key: standing },
        },
        namespace: sittingId,
      })),
      { stale: true }
    )
  );
  return Rec.fromEntries(Arr.zip(SeatStanding.literals, counts));
});
