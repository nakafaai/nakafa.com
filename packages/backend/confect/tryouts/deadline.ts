import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { Id } from "@repo/backend/confect/_generated/id";
import tryoutsInternal from "@repo/backend/confect/_generated/refs/tryouts.server";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  isDue,
  sweepOverdue,
} from "@repo/backend/confect/assessment/gate/deadline";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { attemptStateOf } from "@repo/backend/confect/tryouts/gate";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import {
  expireAttempt,
  finalizeSectionAttempt,
} from "@repo/backend/confect/tryouts/runtime/finish";
import { Clock, Duration, Effect, flow, Option } from "effect";

/** The rows of one kind that one sweep sends on, and the bytes each page may read. */
const SWEEP_PAGE = 50;
const SWEEP_ATTEMPT_BYTES = 6 * 1024 * 1024;
const SWEEP_SECTION_BYTES = 2 * 1024 * 1024;

/**
 * Whether a try-out deadline job still has work: its row is still in progress at the deadline the job was scheduled
 * for, and that deadline passed (`isDue`). A try-out job names its deadline, so a job left from an earlier deadline
 * changes nothing.
 */
const dueAt = (
  row: Option.Option<
    Pick<
      Docs["tryoutAttempts"] | Docs["tryoutSectionAttempts"],
      "expiresAt" | "status"
    >
  >,
  expiresAt: number,
  now: number
) =>
  Option.exists(
    row,
    (found) =>
      found.expiresAt === expiresAt &&
      isDue(
        { deadline: found.expiresAt, state: attemptStateOf(found.status) },
        now
      )
  );

/** Reads one attempt by ID, none once it is gone. */
const loadAttempt = (attemptId: Id<"tryoutAttempts">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("tryoutAttempts")
      .get(attemptId)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
        Effect.mapError(toTryoutRuntimeError)
      )
  );

/** Expires an attempt at its deadline: every running section ends, the rest are recorded, and the attempt is scored. */
export const expireAttemptAt = Effect.fn("tryouts.deadline.attempt")(
  function* (args: { attemptId: Id<"tryoutAttempts">; expiresAt: number }) {
    const attempt = yield* loadAttempt(args.attemptId);
    const now = yield* Clock.currentTimeMillis;
    if (Option.isNone(attempt) || !dueAt(attempt, args.expiresAt, now)) {
      return null;
    }
    yield* expireAttempt({ attempt: attempt.value, now });
    return null;
  }
);

/**
 * Ends a section at its deadline, or the whole attempt once the attempt's own deadline passed too. A section of an
 * attempt that already ended changes nothing, and a section whose attempt is gone is refused.
 */
export const expireSectionAt = Effect.fn("tryouts.deadline.section")(
  function* (args: {
    expiresAt: number;
    sectionAttemptId: Id<"tryoutSectionAttempts">;
  }) {
    const section = yield* (yield* DatabaseReader)
      .table("tryoutSectionAttempts")
      .get(args.sectionAttemptId)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
        Effect.mapError(toTryoutRuntimeError)
      );
    const now = yield* Clock.currentTimeMillis;
    if (Option.isNone(section) || !dueAt(section, args.expiresAt, now)) {
      return null;
    }
    const attempt = yield* loadAttempt(section.value.tryoutAttemptId);
    if (Option.isNone(attempt)) {
      return yield* new TryoutAttemptStateError({
        code: "TRYOUT_ATTEMPT_NOT_FOUND",
        message: "Try-out attempt not found.",
      });
    }
    if (attempt.value.status !== "in-progress") {
      return null;
    }
    if (now >= attempt.value.expiresAt) {
      yield* expireAttempt({ attempt: attempt.value, now });
      return null;
    }
    yield* finalizeSectionAttempt({
      attempt: attempt.value,
      endReason: "time-expired",
      now,
      section: section.value,
    });
    return null;
  }
);

/** Sends again the expiry of each attempt still in progress past its deadline, one byte-bounded page. */
const overdueAttempts = (upTo: number) =>
  Effect.gen(function* () {
    const scheduler = yield* Scheduler;
    const page = yield* (yield* DatabaseReader)
      .table("tryoutAttempts")
      .index("by_status_and_expiresAt", (query) =>
        query.eq("status", "in-progress").lte("expiresAt", upTo)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: SWEEP_ATTEMPT_BYTES,
        maximumRowsRead: SWEEP_PAGE,
        numItems: SWEEP_PAGE,
      })
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      page.page,
      (attempt) =>
        scheduler.runAfter(
          Duration.zero,
          tryoutsInternal.mutations.expiry.attempt,
          { attemptId: attempt._id, expiresAt: attempt.expiresAt }
        ),
      { discard: true }
    );
  });

/** Sends again the expiry of each section still in progress past its deadline, one byte-bounded page. */
const overdueSections = (upTo: number) =>
  Effect.gen(function* () {
    const scheduler = yield* Scheduler;
    const page = yield* (yield* DatabaseReader)
      .table("tryoutSectionAttempts")
      .index("by_status_and_expiresAt", (query) =>
        query.eq("status", "in-progress").lte("expiresAt", upTo)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: SWEEP_SECTION_BYTES,
        maximumRowsRead: SWEEP_PAGE,
        numItems: SWEEP_PAGE,
      })
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      page.page,
      (section) =>
        scheduler.runAfter(
          Duration.zero,
          tryoutsInternal.mutations.expiry.section,
          { expiresAt: section.expiresAt, sectionAttemptId: section._id }
        ),
      { discard: true }
    );
  });

/**
 * Sends again every try-out deadline whose job did not run, through the gate's one sweep (`sweepOverdue`). A section
 * of an attempt that expires in the same sweep finds its attempt ended and changes nothing. A scheduling failure
 * rolls the whole sweep back and comes back as a runtime error.
 */
export const sweepTryoutDeadlines = Effect.fn("tryouts.deadline.sweep")(
  function* () {
    yield* sweepOverdue([overdueAttempts, overdueSections]);
    return null;
  },
  Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail))
);
