import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { tryoutGate } from "@repo/backend/confect/tryouts/gate";
import { toTryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Clock, Duration, Effect, flow, HashSet } from "effect";

const EXPIRY_SWEEP_LIMIT = 50;
const EXPIRY_SWEEP_ATTEMPT_BYTES = 6 * 1024 * 1024;
const EXPIRY_SWEEP_SECTION_BYTES = 2 * 1024 * 1024;
type TryoutSectionAttempt = Docs["tryoutSectionAttempts"];
/** Expires one scheduled attempt at its deadline, through the live-attempt gate. */
export const expireScheduledAttempt = Effect.fn("tryouts.expiry.attempt")(
  function* (args: { attemptId: Id<"tryoutAttempts">; expiresAt: number }) {
    return yield* tryoutGate.expireAttempt(args);
  }
);

/**
 * Ends one scheduled section at its own deadline. A section whose attempt has passed its
 * deadline ends the whole attempt instead, and both writes pass the live-attempt gate.
 */
export const expireScheduledSection = Effect.fn("tryouts.expiry.section")(
  function* (args: {
    expiresAt: number;
    sectionAttemptId: Id<"tryoutSectionAttempts">;
  }) {
    const database = yield* DatabaseReader;
    const sectionRow = yield* database
      .table("tryoutSectionAttempts")
      .get(args.sectionAttemptId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.mapError(toTryoutRuntimeError)
      );
    const now = yield* Clock.currentTimeMillis;
    if (!shouldExpire(sectionRow, args.expiresAt, now)) {
      return null;
    }
    const attemptRow = yield* database
      .table("tryoutAttempts")
      .get(sectionRow.tryoutAttemptId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.mapError(toTryoutRuntimeError)
      );
    if (!attemptRow) {
      return yield* new TryoutAttemptStateError({
        code: "TRYOUT_ATTEMPT_NOT_FOUND",
        message: "Try-out attempt not found.",
      });
    }
    if (now >= attemptRow.expiresAt) {
      return yield* tryoutGate.expireAttempt({
        attemptId: attemptRow._id,
        expiresAt: attemptRow.expiresAt,
      });
    }
    return yield* tryoutGate.expireSection({
      attemptId: attemptRow._id,
      sectionKey: sectionRow.sectionKey,
    });
  }
);

/** Starts one sequential, byte-bounded missed-expiry reconciliation. */
const startExpiryReconciliation = Effect.fn(
  "tryouts.expiry.startReconciliation"
)(function* (before: number) {
  const scheduler = yield* Scheduler;
  yield* scheduler
    .runAfter(
      Duration.millis(0),
      refs.internal.tryouts.mutations.expiry.reconcileAttempts,
      {
        before,
      }
    )
    .pipe(Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail)));
});

/** Starts one current-time expiry sweep through the typed runtime program. */
export const startExpirySweep = Effect.fn("tryouts.expiry.sweep")(function* () {
  yield* startExpiryReconciliation(yield* Clock.currentTimeMillis);
  return null;
});

/** Reconciles missed try-out expiry jobs in bounded pages. */
export const reconcileMissedAttemptExpiries = Effect.fn(
  "tryouts.expiry.reconcileMissedAttemptExpiries"
)(
  function* (before: number) {
    const scheduler = yield* Scheduler;
    const database = yield* DatabaseReader;
    const attemptPage = yield* database
      .table("tryoutAttempts")
      .index("by_status_and_expiresAt", (q) =>
        q.eq("status", "in-progress").lt("expiresAt", before)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: EXPIRY_SWEEP_ATTEMPT_BYTES,
        maximumRowsRead: EXPIRY_SWEEP_LIMIT,
        numItems: EXPIRY_SWEEP_LIMIT,
      })
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      attemptPage.page,
      (attemptRow) =>
        scheduler.runAfter(
          Duration.millis(0),
          refs.internal.tryouts.mutations.expiry.attempt,
          {
            attemptId: attemptRow._id,
            expiresAt: attemptRow.expiresAt,
          }
        ),
      {
        concurrency: "unbounded",
        discard: true,
      }
    );
    const scheduledAttemptIds = Arr.map(
      attemptPage.page,
      (attemptRow) => attemptRow._id
    );
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.tryouts.mutations.expiry.reconcileSections,
      {
        before,
        scheduledAttemptIds,
      }
    );
    return null;
  },
  Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail))
);

/** Queues section expiries whose parent was not handled by the attempt phase. */
export const reconcileMissedSectionExpiries = Effect.fn(
  "tryouts.expiry.reconcileMissedSectionExpiries"
)(
  function* (args: {
    before: number;
    scheduledAttemptIds: Id<"tryoutAttempts">[];
  }) {
    const scheduler = yield* Scheduler;
    const database = yield* DatabaseReader;
    const sectionPage = yield* database
      .table("tryoutSectionAttempts")
      .index("by_status_and_expiresAt", (q) =>
        q.eq("status", "in-progress").lt("expiresAt", args.before)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: EXPIRY_SWEEP_SECTION_BYTES,
        maximumRowsRead: EXPIRY_SWEEP_LIMIT,
        numItems: EXPIRY_SWEEP_LIMIT,
      })
      .pipe(Effect.orDie);
    const scheduledAttemptIds = HashSet.fromIterable(args.scheduledAttemptIds);
    yield* Effect.forEach(
      Arr.filter(
        sectionPage.page,
        (sectionRow) =>
          !HashSet.has(scheduledAttemptIds, sectionRow.tryoutAttemptId)
      ),
      (sectionRow) =>
        scheduler.runAfter(
          Duration.millis(0),
          refs.internal.tryouts.mutations.expiry.section,
          {
            expiresAt: sectionRow.expiresAt,
            sectionAttemptId: sectionRow._id,
          }
        ),
      {
        concurrency: "unbounded",
        discard: true,
      }
    );
    return null;
  },
  Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail))
);

/** Returns true when a scheduled section expiry still matches an open section that is due. */
function shouldExpire(
  row: TryoutSectionAttempt | null,
  scheduledExpiresAt: number,
  now: number
): row is TryoutSectionAttempt {
  return Boolean(
    row &&
      row.status === "in-progress" &&
      row.expiresAt === scheduledExpiresAt &&
      now >= row.expiresAt
  );
}
