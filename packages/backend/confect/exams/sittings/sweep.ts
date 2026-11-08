import type { ExamAttemptsDoc } from "@repo/backend/confect/_generated/docs";
import examsInternal from "@repo/backend/confect/_generated/refs/exams.server";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { sweepOverdue } from "@repo/backend/confect/assessment/gate/deadline";
import { SUBMIT_DELAY_MS } from "@repo/backend/confect/exams/sittings/timers";
import { Duration, Effect } from "effect";

/** How often the sweep runs. */
export const SITTING_SWEEP_INTERVAL = Duration.minutes(1);

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

/** Opens again each room still scheduled past its opening time. */
const unopened = (upTo: number) =>
  Effect.gen(function* () {
    const scheduler = yield* Scheduler;
    const rooms = yield* (yield* DatabaseReader)
      .table("examSittings")
      .index("by_state_and_opensAt", (query) =>
        query.eq("state", "scheduled").lte("opensAt", upTo)
      )
      .take(SWEEP_PAGE)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      rooms,
      (sitting) =>
        scheduler.runAfter(Duration.zero, examsInternal.sittings.timers.open, {
          sittingId: sitting._id,
        }),
      { discard: true }
    );
  });

/** Closes again each room still open past its closing time. */
const unclosed = (upTo: number) =>
  Effect.gen(function* () {
    const scheduler = yield* Scheduler;
    const rooms = yield* (yield* DatabaseReader)
      .table("examSittings")
      .index("by_state_and_closesAt", (query) =>
        query.eq("state", "open").lte("closesAt", upTo)
      )
      .take(SWEEP_PAGE)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      rooms,
      (sitting) =>
        scheduler.runAfter(
          Duration.zero,
          examsInternal.sittings.timers.closeDue,
          { atDeadline: "closesAt", sittingId: sitting._id }
        ),
      { discard: true }
    );
  });

/** Closes again each attempt still taking writes past its own deadline, in progress or locked. */
const unendedAttempts = (upTo: number) =>
  Effect.gen(function* () {
    const scheduler = yield* Scheduler;
    const inProgress = yield* attemptsDue("inProgress", upTo);
    const locked = yield* attemptsDue("locked", upTo);
    yield* Effect.forEach(
      [...inProgress, ...locked],
      (attempt) =>
        scheduler.runAfter(
          Duration.zero,
          examsInternal.sittings.timers.closeAttempt,
          { attemptId: attempt._id }
        ),
      { discard: true }
    );
  });

/** Submits again each closing attempt past its submission window. */
const unsubmitted = (upTo: number) =>
  Effect.gen(function* () {
    const scheduler = yield* Scheduler;
    const closing = yield* attemptsDue("closing", upTo - SUBMIT_DELAY_MS);
    yield* Effect.forEach(
      closing,
      (attempt) =>
        scheduler.runAfter(
          Duration.zero,
          examsInternal.sittings.timers.submit,
          { attemptId: attempt._id }
        ),
      { discard: true }
    );
  });

/**
 * Sends again every scheduled step of a sitting that has not happened, through the gate's one sweep
 * (`sweepOverdue`). Convex runs a scheduled mutation once and does not retry one that failed, so without this a
 * close that ran out of time leaves the room's students at zero, with a finish the gate refuses and no result, and a
 * failed submit loses one student's result. Each step is its own job, so one that keeps failing holds back no other,
 * and each is safe to run twice, because it reads the row's state first (ADR 0013).
 */
export const sweepLate = Effect.fn("exams.sittings.sweep")(function* () {
  yield* sweepOverdue([unopened, unclosed, unendedAttempts, unsubmitted]);
  return null;
});
