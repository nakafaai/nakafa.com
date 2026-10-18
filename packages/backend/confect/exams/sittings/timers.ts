import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { DateTime, Effect } from "effect";

/**
 * How long a closing attempt waits before the server submits it. Without presence the
 * window is the blueprint's disconnect window of 75 seconds (blueprint 60-exam, section
 * "Kehadiran"), so a device that is still sending its records has time to send them.
 */
const SUBMIT_DELAY_MS = 75_000;

/** Schedules the opening of a sitting at its opening time. */
export const scheduleOpen = Effect.fn("exams.sittings.timers.open")(function* (
  sittingId: ExamSittingsDoc["_id"],
  opensAt: number
) {
  return yield* (yield* Scheduler).runAt(
    DateTime.makeUnsafe(opensAt),
    refs.internal.exams.sittings.timers.open,
    { sittingId }
  );
});

/** Schedules the closing of a sitting at its closing time. */
export const scheduleClose = Effect.fn("exams.sittings.timers.close")(
  function* (sittingId: ExamSittingsDoc["_id"], closesAt: number) {
    return yield* (yield* Scheduler).runAt(
      DateTime.makeUnsafe(closesAt),
      refs.internal.exams.sittings.timers.closeDue,
      { atDeadline: "closesAt", sittingId }
    );
  }
);

/** Schedules the close of one attempt at its own deadline, after added minutes moved it. */
export const scheduleAttemptClose = Effect.fn("exams.sittings.timers.attempt")(
  function* (attemptId: ExamAttemptsDoc["_id"], deadline: number) {
    return yield* (yield* Scheduler).runAt(
      DateTime.makeUnsafe(deadline),
      refs.internal.exams.sittings.timers.closeAttempt,
      { attemptId }
    );
  }
);

/**
 * Cancels one scheduled job, and only while it is still pending. Convex fails to cancel a
 * mutation that has committed, so a job that has run is left alone. A job whose row no
 * longer exists is left alone too, because there is nothing to cancel.
 */
export const cancelPending = Effect.fn("exams.sittings.timers.cancel")(
  function* (jobId: ExamSittingsDoc["jobs"][number]) {
    const job = yield* (yield* DatabaseReader)
      .table("_scheduled_functions")
      .get(jobId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (job?.state.kind === "pending") {
      yield* (yield* Scheduler).cancel(jobId);
    }
  }
);

/** Schedules the submission of a closing attempt, `SUBMIT_DELAY_MS` after its deadline. */
export const scheduleSubmit = Effect.fn("exams.sittings.timers.submit")(
  function* (attemptId: ExamAttemptsDoc["_id"], deadline: number) {
    return yield* (yield* Scheduler).runAt(
      DateTime.makeUnsafe(deadline + SUBMIT_DELAY_MS),
      refs.internal.exams.sittings.timers.submit,
      { attemptId }
    );
  }
);
