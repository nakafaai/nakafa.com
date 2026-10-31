import type { ExamAttemptsDoc } from "@repo/backend/confect/_generated/docs";
import examsInternal from "@repo/backend/confect/_generated/refs/exams.server";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { SUBMIT_DELAY_MS } from "@repo/backend/confect/exams/sittings/timers";
import { Clock, Duration, Effect } from "effect";

/** How often the sweep runs. */
export const SITTING_SWEEP_INTERVAL = Duration.minutes(1);

/** How late a step may run before the sweep sends it again, so a step that is only busy is not doubled. */
export const SWEEP_LATE_MS = 60_000;

/** The most rows of one kind that one sweep sends on. The next sweep takes the rest. */
const SWEEP_PAGE = 100;

/** The attempts in one state whose deadline is at or before `upTo`, oldest first. */
const attemptsDue = Effect.fn("exams.sittings.sweep.attempts")(function* (
  state: ExamAttemptsDoc["state"],
  upTo: number
) {
  return yield* (yield* DatabaseReader)
    .table("examAttempts")
    .index("by_state_and_deadline", (query) =>
      query.eq("state", state).lte("deadline", upTo)
    )
    .take(SWEEP_PAGE)
    .pipe(Effect.orDie);
});

/**
 * Sends again every scheduled step of a sitting that has not happened. Convex runs a scheduled mutation once and
 * does not retry one that failed, so without this a close that ran out of time leaves the room's students at
 * zero, with a finish the gate refuses and no result, and a failed submit loses one student's result. Each step
 * is its own job, so one that keeps failing holds back no other, and each is safe to run twice, because it reads
 * the row's state first (ADR 0013).
 */
export const sweepLate = Effect.fn("exams.sittings.sweep")(function* () {
  const reader = yield* DatabaseReader;
  const scheduler = yield* Scheduler;
  const { timers } = examsInternal.sittings;
  const late = (yield* Clock.currentTimeMillis) - SWEEP_LATE_MS;

  const unopened = yield* reader
    .table("examSittings")
    .index("by_state_and_opensAt", (query) =>
      query.eq("state", "scheduled").lte("opensAt", late)
    )
    .take(SWEEP_PAGE)
    .pipe(Effect.orDie);
  yield* Effect.forEach(unopened, (sitting) =>
    scheduler.runAfter(Duration.zero, timers.open, { sittingId: sitting._id })
  );

  const unclosed = yield* reader
    .table("examSittings")
    .index("by_state_and_closesAt", (query) =>
      query.eq("state", "open").lte("closesAt", late)
    )
    .take(SWEEP_PAGE)
    .pipe(Effect.orDie);
  yield* Effect.forEach(unclosed, (sitting) =>
    scheduler.runAfter(Duration.zero, timers.closeDue, {
      atDeadline: "closesAt",
      sittingId: sitting._id,
    })
  );

  const inProgress = yield* attemptsDue("inProgress", late);
  const locked = yield* attemptsDue("locked", late);
  yield* Effect.forEach([...inProgress, ...locked], (attempt) =>
    scheduler.runAfter(Duration.zero, timers.closeAttempt, {
      attemptId: attempt._id,
    })
  );

  const closing = yield* attemptsDue("closing", late - SUBMIT_DELAY_MS);
  yield* Effect.forEach(closing, (attempt) =>
    scheduler.runAfter(Duration.zero, timers.submit, { attemptId: attempt._id })
  );
  return null;
});
