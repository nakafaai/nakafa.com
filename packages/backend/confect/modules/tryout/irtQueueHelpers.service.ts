import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { workflow } from "@repo/backend/confect/modules/operations/workflow";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import {
  IRT_OPERATIONAL_MODEL,
  IRT_QUEUE_CLEANUP_BATCH_SIZE,
  IRT_SCALE_QUALITY_REFRESH_CLAIM_TIMEOUT_MS,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import { Clock, Effect, Option } from "effect";

const MAX_CALIBRATION_QUEUE_ROWS_PER_ATTEMPT = 2;

/** Starts a calibration workflow when no run is already running for the set. */
export const startCalibrationRunWorkflow = Effect.fn(
  "irt.queue.startCalibrationRunWorkflow"
)(function* (ctx: ConvexMutationCtx, setId: Id<"exerciseSets">) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const now = yield* Clock.currentTimeMillis;
  const set = yield* reader
    .table("exerciseSets")
    .get(setId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!set) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_SET_NOT_FOUND",
        message: "Exercise set not found for calibration.",
      })
    );
  }

  const latestRun = yield* reader
    .table("irtCalibrationRuns")
    .index(
      "by_setId_and_startedAt",
      (query) => query.eq("setId", setId),
      "desc"
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (latestRun?.status === "running") {
    return null;
  }

  const calibrationRunId = yield* writer.table("irtCalibrationRuns").insert({
    attemptCount: 0,
    iterationCount: 0,
    maxParameterDelta: 0,
    model: IRT_OPERATIONAL_MODEL,
    questionCount: set.questionCount,
    responseCount: 0,
    setId,
    startedAt: now,
    status: "running",
    updatedAt: now,
  });

  // The Convex Workflow component starts with native ctx/function references.
  // Reference: https://confect.dev/server/components
  yield* Effect.promise(() =>
    workflow.start(
      ctx,
      Ref.getFunctionReference(refs.internal.irt.workflows.calibrateSetTwoPL),
      {
        calibrationRunId,
        setId,
      }
    )
  );

  return calibrationRunId;
});

/** Finds the unique pending calibration queue row for one attempt. */
export const getPendingCalibrationQueueEntryForAttempt = Effect.fn(
  "irt.queue.getPendingCalibrationQueueEntryForAttempt"
)(function* (attemptId: Id<"exerciseAttempts">) {
  const reader = yield* DatabaseReader;
  const queueEntries = yield* reader
    .table("irtCalibrationQueue")
    .index("by_attemptId_and_enqueuedAt", (query) =>
      query.eq("attemptId", attemptId)
    )
    .take(MAX_CALIBRATION_QUEUE_ROWS_PER_ATTEMPT);

  if (queueEntries.length <= 1) {
    return queueEntries[0] ?? null;
  }

  return yield* Effect.fail(
    new IrtError({
      code: "IRT_CALIBRATION_QUEUE_DUPLICATE_ATTEMPT",
      message: "Multiple pending calibration queue rows exist for one attempt.",
    })
  );
});

/** Ensures one pending calibration queue row exists for the attempt. */
export const ensurePendingCalibrationQueueEntry = Effect.fn(
  "irt.queue.ensurePendingCalibrationQueueEntry"
)(function* (args: {
  readonly attemptId: Id<"exerciseAttempts">;
  readonly enqueuedAt: number;
  readonly setId: Id<"exerciseSets">;
}) {
  const writer = yield* DatabaseWriter;
  const existingQueueEntry = yield* getPendingCalibrationQueueEntryForAttempt(
    args.attemptId
  );

  if (!existingQueueEntry) {
    yield* writer.table("irtCalibrationQueue").insert({
      attemptId: args.attemptId,
      enqueuedAt: args.enqueuedAt,
      setId: args.setId,
    });
    return null;
  }

  if (existingQueueEntry.setId === args.setId) {
    return null;
  }

  yield* writer.table("irtCalibrationQueue").patch(existingQueueEntry._id, {
    enqueuedAt: args.enqueuedAt,
    setId: args.setId,
  });

  return null;
});

/** Removes one pending calibration queue row for an attempt. */
export const removePendingCalibrationQueueEntry = Effect.fn(
  "irt.queue.removePendingCalibrationQueueEntry"
)(function* (attemptId: Id<"exerciseAttempts">) {
  const writer = yield* DatabaseWriter;
  const existingQueueEntry =
    yield* getPendingCalibrationQueueEntryForAttempt(attemptId);

  if (!existingQueueEntry) {
    return null;
  }

  yield* writer.table("irtCalibrationQueue").delete(existingQueueEntry._id);
  return null;
});

/** Deletes stale calibration queue rows through a bounded batch. */
export const cleanupCalibrationQueueEntriesBatch = Effect.fn(
  "irt.queue.cleanupCalibrationQueueEntriesBatch"
)(function* (args: {
  readonly setId: Id<"exerciseSets">;
  readonly throughAt: number;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const queueEntries = yield* reader
    .table("irtCalibrationQueue")
    .index("by_setId_and_enqueuedAt", (query) =>
      query.eq("setId", args.setId).lte("enqueuedAt", args.throughAt)
    )
    .take(IRT_QUEUE_CLEANUP_BATCH_SIZE);

  for (const entry of queueEntries) {
    yield* writer.table("irtCalibrationQueue").delete(entry._id);
  }

  return queueEntries.length;
});

/** Deletes scale-publication queue rows for one tryout through a bounded batch. */
export const cleanupScalePublicationQueueEntriesBatch = Effect.fn(
  "irt.queue.cleanupScalePublicationQueueEntriesBatch"
)(function* (tryoutId: Id<"tryouts">) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const queueEntries = yield* reader
    .table("irtScalePublicationQueue")
    .index("by_tryoutId_and_enqueuedAt", (query) =>
      query.eq("tryoutId", tryoutId)
    )
    .take(IRT_QUEUE_CLEANUP_BATCH_SIZE);

  for (const entry of queueEntries) {
    yield* writer.table("irtScalePublicationQueue").delete(entry._id);
  }

  return queueEntries.length;
});

/** Enqueues or replaces a stale scale-quality refresh row. */
export const enqueueScaleQualityRefresh = Effect.fn(
  "irt.queue.enqueueScaleQualityRefresh"
)(function* (args: {
  readonly enqueuedAt: number;
  readonly tryoutId: Id<"tryouts">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const now = yield* Clock.currentTimeMillis;
  const existingEntry = yield* reader
    .table("irtScaleQualityRefreshQueue")
    .index("by_tryoutId", (query) => query.eq("tryoutId", args.tryoutId))
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!existingEntry) {
    yield* writer.table("irtScaleQualityRefreshQueue").insert({
      enqueuedAt: args.enqueuedAt,
      tryoutId: args.tryoutId,
    });
    return true;
  }

  const staleProcessingStartedAt =
    existingEntry.processingStartedAt !== undefined &&
    existingEntry.processingStartedAt <=
      now - IRT_SCALE_QUALITY_REFRESH_CLAIM_TIMEOUT_MS;

  if (!staleProcessingStartedAt) {
    return false;
  }

  yield* writer
    .table("irtScaleQualityRefreshQueue")
    .replace(existingEntry._id, {
      enqueuedAt: args.enqueuedAt,
      tryoutId: args.tryoutId,
    });

  return true;
});
