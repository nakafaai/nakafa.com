import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { workflow } from "@repo/backend/confect/modules/operations/workflow";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import {
  IRT_OPERATIONAL_MODEL,
  IRT_QUEUE_CLEANUP_BATCH_SIZE,
  IRT_SCALE_QUALITY_REFRESH_CLAIM_TIMEOUT_MS,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import { Clock, Effect } from "effect";

const MAX_CALIBRATION_QUEUE_ROWS_PER_ATTEMPT = 2;

/** Starts a calibration workflow when no run is already running for the set. */
export const startCalibrationRunWorkflow = Effect.fn(
  "irt.queue.startCalibrationRunWorkflow"
)(function* (ctx: ConvexMutationCtx, setId: Id<"exerciseSets">) {
  const now = yield* Clock.currentTimeMillis;
  const set = yield* Effect.promise(() => ctx.db.get(setId));

  if (!set) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_SET_NOT_FOUND",
        message: "Exercise set not found for calibration.",
      })
    );
  }

  const latestRun = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationRuns")
      .withIndex("by_setId_and_startedAt", (query) => query.eq("setId", setId))
      .order("desc")
      .first()
  );

  if (latestRun?.status === "running") {
    return null;
  }

  const calibrationRunId = yield* Effect.promise(() =>
    ctx.db.insert("irtCalibrationRuns", {
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
    })
  );

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
)(function* (ctx: ConvexMutationCtx, attemptId: Id<"exerciseAttempts">) {
  const queueEntries = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationQueue")
      .withIndex("by_attemptId_and_enqueuedAt", (query) =>
        query.eq("attemptId", attemptId)
      )
      .take(MAX_CALIBRATION_QUEUE_ROWS_PER_ATTEMPT)
  );

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
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly attemptId: Id<"exerciseAttempts">;
    readonly enqueuedAt: number;
    readonly setId: Id<"exerciseSets">;
  }
) {
  const existingQueueEntry = yield* getPendingCalibrationQueueEntryForAttempt(
    ctx,
    args.attemptId
  );

  if (!existingQueueEntry) {
    yield* Effect.promise(() =>
      ctx.db.insert("irtCalibrationQueue", {
        attemptId: args.attemptId,
        enqueuedAt: args.enqueuedAt,
        setId: args.setId,
      })
    );
    return null;
  }

  if (existingQueueEntry.setId === args.setId) {
    return null;
  }

  yield* Effect.promise(() =>
    ctx.db.patch(existingQueueEntry._id, {
      enqueuedAt: args.enqueuedAt,
      setId: args.setId,
    })
  );

  return null;
});

/** Removes one pending calibration queue row for an attempt. */
export const removePendingCalibrationQueueEntry = Effect.fn(
  "irt.queue.removePendingCalibrationQueueEntry"
)(function* (ctx: ConvexMutationCtx, attemptId: Id<"exerciseAttempts">) {
  const existingQueueEntry = yield* getPendingCalibrationQueueEntryForAttempt(
    ctx,
    attemptId
  );

  if (!existingQueueEntry) {
    return null;
  }

  yield* Effect.promise(() => ctx.db.delete(existingQueueEntry._id));
  return null;
});

/** Builds the pending queue query for one calibration set. */
export function getPendingCalibrationQueueQuery(
  ctx: ConvexMutationCtx,
  args: {
    readonly lastSuccessfulRunStartedAt: number | undefined;
    readonly setId: Id<"exerciseSets">;
  }
) {
  return ctx.db
    .query("irtCalibrationQueue")
    .withIndex("by_setId_and_enqueuedAt", (query) => {
      const setQuery = query.eq("setId", args.setId);

      if (args.lastSuccessfulRunStartedAt === undefined) {
        return setQuery;
      }

      return setQuery.gt("enqueuedAt", args.lastSuccessfulRunStartedAt);
    });
}

/** Deletes stale calibration queue rows through a bounded batch. */
export const cleanupCalibrationQueueEntriesBatch = Effect.fn(
  "irt.queue.cleanupCalibrationQueueEntriesBatch"
)(function* (
  ctx: ConvexMutationCtx,
  args: { readonly setId: Id<"exerciseSets">; readonly throughAt: number }
) {
  const queueEntries = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationQueue")
      .withIndex("by_setId_and_enqueuedAt", (query) =>
        query.eq("setId", args.setId).lte("enqueuedAt", args.throughAt)
      )
      .take(IRT_QUEUE_CLEANUP_BATCH_SIZE)
  );

  for (const entry of queueEntries) {
    yield* Effect.promise(() => ctx.db.delete(entry._id));
  }

  return queueEntries.length;
});

/** Deletes scale-publication queue rows for one tryout through a bounded batch. */
export const cleanupScalePublicationQueueEntriesBatch = Effect.fn(
  "irt.queue.cleanupScalePublicationQueueEntriesBatch"
)(function* (ctx: ConvexMutationCtx, tryoutId: Id<"tryouts">) {
  const queueEntries = yield* Effect.promise(() =>
    ctx.db
      .query("irtScalePublicationQueue")
      .withIndex("by_tryoutId_and_enqueuedAt", (query) =>
        query.eq("tryoutId", tryoutId)
      )
      .take(IRT_QUEUE_CLEANUP_BATCH_SIZE)
  );

  for (const entry of queueEntries) {
    yield* Effect.promise(() => ctx.db.delete(entry._id));
  }

  return queueEntries.length;
});

/** Enqueues or replaces a stale scale-quality refresh row. */
export const enqueueScaleQualityRefresh = Effect.fn(
  "irt.queue.enqueueScaleQualityRefresh"
)(function* (
  ctx: ConvexMutationCtx,
  args: { readonly enqueuedAt: number; readonly tryoutId: Id<"tryouts"> }
) {
  const now = yield* Clock.currentTimeMillis;
  const existingEntry = yield* Effect.promise(() =>
    ctx.db
      .query("irtScaleQualityRefreshQueue")
      .withIndex("by_tryoutId", (query) => query.eq("tryoutId", args.tryoutId))
      .first()
  );

  if (!existingEntry) {
    yield* Effect.promise(() =>
      ctx.db.insert("irtScaleQualityRefreshQueue", {
        enqueuedAt: args.enqueuedAt,
        tryoutId: args.tryoutId,
      })
    );
    return true;
  }

  const staleProcessingStartedAt =
    existingEntry.processingStartedAt !== undefined &&
    existingEntry.processingStartedAt <=
      now - IRT_SCALE_QUALITY_REFRESH_CLAIM_TIMEOUT_MS;

  if (!staleProcessingStartedAt) {
    return false;
  }

  yield* Effect.promise(() =>
    ctx.db.replace(existingEntry._id, {
      enqueuedAt: args.enqueuedAt,
      tryoutId: args.tryoutId,
    })
  );

  return true;
});
