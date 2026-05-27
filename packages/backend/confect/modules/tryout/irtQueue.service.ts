import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  IRT_CALIBRATION_QUEUE_BATCH_SIZE,
  IRT_MAX_CALIBRATION_STALENESS_MS,
  IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION,
  IRT_QUEUE_CLEANUP_BATCH_SIZE,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import { prepareCalibrationCacheForSet } from "@repo/backend/confect/modules/tryout/irtCache.service";
import {
  cleanupCalibrationQueueEntriesBatch,
  cleanupScalePublicationQueueEntriesBatch,
  getPendingCalibrationQueueQuery,
  startCalibrationRunWorkflow,
} from "@repo/backend/confect/modules/tryout/irtQueueHelpers.service";
import { Clock, Effect } from "effect";

/** Enqueues one tryout for serialized scale publication. */
export const enqueueScalePublication = Effect.fn(
  "irt.queue.enqueueScalePublication"
)(function* (args: { readonly tryoutId: Id<"tryouts"> }) {
  const ctx = yield* MutationCtx;
  const existingEntry = yield* Effect.promise(() =>
    ctx.db
      .query("irtScalePublicationQueue")
      .withIndex("by_tryoutId_and_enqueuedAt", (query) =>
        query.eq("tryoutId", args.tryoutId)
      )
      .first()
  );

  if (existingEntry) {
    return null;
  }

  const enqueuedAt = yield* Clock.currentTimeMillis;
  yield* Effect.promise(() =>
    ctx.db.insert("irtScalePublicationQueue", {
      enqueuedAt,
      tryoutId: args.tryoutId,
    })
  );

  return null;
});

/** Drains pending calibration queue entries and starts eligible calibration workflows. */
export const drainCalibrationQueue = Effect.fn(
  "irt.queue.drainCalibrationQueue"
)(function* () {
  const ctx = yield* MutationCtx;
  const now = yield* Clock.currentTimeMillis;
  const queueEntries = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationQueue")
      .withIndex("by_enqueuedAt")
      .take(
        IRT_CALIBRATION_QUEUE_BATCH_SIZE *
          IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION
      )
  );
  const distinctSetIds = [
    ...new Set(queueEntries.map((entry) => entry.setId)),
  ].slice(0, IRT_CALIBRATION_QUEUE_BATCH_SIZE);

  for (const setId of distinctSetIds) {
    const cacheIsWithinLimit = yield* prepareCalibrationCacheForSet(ctx, setId);

    if (!cacheIsWithinLimit) {
      continue;
    }

    const [latestCompletedRun, latestRun] = yield* Effect.promise(() =>
      Promise.all([
        ctx.db
          .query("irtCalibrationRuns")
          .withIndex("by_setId_and_status_and_startedAt", (query) =>
            query.eq("setId", setId).eq("status", "completed")
          )
          .order("desc")
          .first(),
        ctx.db
          .query("irtCalibrationRuns")
          .withIndex("by_setId_and_startedAt", (query) =>
            query.eq("setId", setId)
          )
          .order("desc")
          .first(),
      ])
    );

    if (latestRun?.status === "running") {
      continue;
    }

    const lastSuccessfulRunStartedAt = latestCompletedRun?.startedAt;
    const pendingQueueEntries = yield* Effect.promise(() =>
      getPendingCalibrationQueueQuery(ctx, {
        lastSuccessfulRunStartedAt,
        setId,
      }).take(IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION)
    );

    if (pendingQueueEntries.length === 0) {
      if (lastSuccessfulRunStartedAt !== undefined) {
        yield* Effect.promise(() =>
          ctx.scheduler.runAfter(
            0,
            Ref.getFunctionReference(
              refs.internal.irt.mutations.internalFunctions.queue
                .cleanupCalibrationQueueEntries
            ),
            {
              setId,
              throughAt: lastSuccessfulRunStartedAt,
            }
          )
        );
      }

      continue;
    }

    const oldestPendingQueueEntry = pendingQueueEntries[0];

    if (!oldestPendingQueueEntry) {
      continue;
    }

    const hasEnoughCompletedAttempts =
      pendingQueueEntries.length >=
      IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION;
    const isStale =
      now - oldestPendingQueueEntry.enqueuedAt >=
      IRT_MAX_CALIBRATION_STALENESS_MS;

    if (!(hasEnoughCompletedAttempts || isStale)) {
      continue;
    }

    yield* startCalibrationRunWorkflow(ctx, setId);
  }

  return null;
});

/** Deletes stale calibration queue entries and reschedules when more rows remain. */
export const cleanupCalibrationQueueEntries = Effect.fn(
  "irt.queue.cleanupCalibrationQueueEntries"
)(function* (args: {
  readonly setId: Id<"exerciseSets">;
  readonly throughAt: number;
}) {
  const ctx = yield* MutationCtx;
  const deletedCount = yield* cleanupCalibrationQueueEntriesBatch(ctx, args);

  if (deletedCount < IRT_QUEUE_CLEANUP_BATCH_SIZE) {
    return null;
  }

  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(
      0,
      Ref.getFunctionReference(
        refs.internal.irt.mutations.internalFunctions.queue
          .cleanupCalibrationQueueEntries
      ),
      args
    )
  );

  return null;
});

/** Deletes scale publication queue entries and reschedules when more rows remain. */
export const cleanupScalePublicationQueueEntries = Effect.fn(
  "irt.queue.cleanupScalePublicationQueueEntries"
)(function* (args: { readonly tryoutId: Id<"tryouts"> }) {
  const ctx = yield* MutationCtx;
  const deletedCount = yield* cleanupScalePublicationQueueEntriesBatch(
    ctx,
    args.tryoutId
  );

  if (deletedCount < IRT_QUEUE_CLEANUP_BATCH_SIZE) {
    return null;
  }

  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(
      0,
      Ref.getFunctionReference(
        refs.internal.irt.mutations.internalFunctions.queue
          .cleanupScalePublicationQueueEntries
      ),
      args
    )
  );

  return null;
});
