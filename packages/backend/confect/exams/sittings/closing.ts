import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { scheduleSubmit } from "@repo/backend/confect/exams/sittings/timers";
import { Array as Arr, Clock, Duration, Effect, Number as Num } from "effect";

/**
 * The most attempts that one run of the close moves. A run that fills its page schedules
 * the next run, so a sitting with many attempts closes in bounded steps (round 2, decision 8).
 */
const CLOSE_PAGE = 100;

/** Opens a sitting at its opening time, unless a proctor closed it before then. */
export const openSitting = Effect.fn("exams.sittings.timers.open")(function* (
  sittingId: ExamSittingsDoc["_id"]
) {
  const reader = yield* DatabaseReader;
  const sitting = yield* reader
    .table("examSittings")
    .get(sittingId)
    .pipe(Effect.orDie);
  if (sitting.state === "scheduled") {
    yield* (yield* DatabaseWriter)
      .table("examSittings")
      .patch(sitting._id, { state: "open" })
      .pipe(Effect.orDie);
  }
  return null;
});

/**
 * The open attempts of a sitting that the close moves, in one state. A scheduled close
 * reads the attempts whose deadline is at or before the sitting's closing time, so an
 * attempt that added minutes keeps its later deadline. A proctor's close reads them all.
 */
const openAttempts = Effect.fn("exams.sittings.closing.open")(function* (
  sitting: ExamSittingsDoc,
  state: "inProgress" | "locked",
  atDeadline: "closesAt" | "now"
) {
  return yield* (yield* DatabaseReader)
    .table("examAttempts")
    .index("by_sittingId_and_state_and_deadline", (query) => {
      const byState = query.eq("sitting", sitting._id).eq("state", state);
      return atDeadline === "closesAt"
        ? byState.lte("deadline", sitting.closesAt)
        : byState;
    })
    .take(CLOSE_PAGE)
    .pipe(Effect.orDie);
});

/** Closes one attempt: it moves to closing, its deadline is `now` at most, and its submission is scheduled. */
const closeAttempt = Effect.fn("exams.sittings.closing.attempt")(function* (
  attempt: ExamAttemptsDoc,
  atDeadline: "closesAt" | "now",
  now: number
) {
  const deadline =
    atDeadline === "now" ? Num.min(attempt.deadline, now) : attempt.deadline;
  yield* (yield* DatabaseWriter)
    .table("examAttempts")
    .patch(attempt._id, { deadline, state: "closing" })
    .pipe(Effect.orDie);
  yield* scheduleSubmit(attempt._id, deadline);
});

/**
 * Closes one page of a sitting's open attempts, and schedules the next page while this
 * one is full. A sitting first becomes closed. The scheduled close reads the attempts
 * up to the sitting's closing time, and a proctor's close, with `now`, reads them all
 * and sets each deadline to now (ADR 0013, round 2 decisions 2, 8).
 */
export const closeDue = Effect.fn("exams.sittings.timers.closeDue")(
  function* (args: {
    atDeadline: "closesAt" | "now";
    sittingId: ExamSittingsDoc["_id"];
  }) {
    const writer = yield* DatabaseWriter;
    const sitting = yield* (yield* DatabaseReader)
      .table("examSittings")
      .get(args.sittingId)
      .pipe(Effect.orDie);
    if (sitting.state !== "closed") {
      yield* writer
        .table("examSittings")
        .patch(sitting._id, { state: "closed" })
        .pipe(Effect.orDie);
    }
    const now = yield* Clock.currentTimeMillis;
    const inProgress = yield* openAttempts(
      sitting,
      "inProgress",
      args.atDeadline
    );
    const locked = yield* openAttempts(sitting, "locked", args.atDeadline);
    const page = Arr.take([...inProgress, ...locked], CLOSE_PAGE);
    yield* Effect.forEach(page, (attempt) =>
      closeAttempt(attempt, args.atDeadline, now)
    );
    if (page.length === CLOSE_PAGE) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.exams.sittings.timers.closeDue,
        args
      );
    }
    return null;
  }
);

/**
 * Closes one attempt at its own deadline, after added minutes moved the deadline. An
 * attempt that a proctor already closed is left alone.
 */
export const closeOneAttempt = Effect.fn("exams.sittings.timers.closeAttempt")(
  function* (args: { attemptId: ExamAttemptsDoc["_id"] }) {
    const attempt = yield* (yield* DatabaseReader)
      .table("examAttempts")
      .get(args.attemptId)
      .pipe(Effect.orDie);
    const now = yield* Clock.currentTimeMillis;
    const open = attempt.state === "inProgress" || attempt.state === "locked";
    if (open && now >= attempt.deadline) {
      yield* closeAttempt(attempt, "closesAt", now);
    }
    return null;
  }
);

/** Submits a closing attempt, once its submission window has passed. Submitting twice changes nothing. */
export const submitAttempt = Effect.fn("exams.sittings.timers.submit")(
  function* (args: { attemptId: ExamAttemptsDoc["_id"] }) {
    const attempt = yield* (yield* DatabaseReader)
      .table("examAttempts")
      .get(args.attemptId)
      .pipe(Effect.orDie);
    if (attempt.state === "closing") {
      const now = yield* Clock.currentTimeMillis;
      yield* (yield* DatabaseWriter)
        .table("examAttempts")
        .patch(attempt._id, { state: "submitted", submittedAt: now })
        .pipe(Effect.orDie);
    }
    return null;
  }
);
