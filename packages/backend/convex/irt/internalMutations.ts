import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  backfillCalibrationResponsesPageHandler,
  syncCalibrationResponsesForAttemptHandler,
} from "@repo/backend/convex/irt/helpers/attempts";
import {
  adjustCalibrationCacheAttemptCount,
  calibrationCacheStatsRebuildProgressValidator,
  prepareCalibrationCacheForSet,
  rebuildCalibrationCacheStatsForSetHandler,
  rebuildCalibrationCacheStatsPageHandler,
  trimCalibrationCacheForSetHandler,
} from "@repo/backend/convex/irt/helpers/cache";
import {
  cleanupCalibrationQueueEntriesBatch,
  cleanupScalePublicationQueueEntriesBatch,
  getPendingCalibrationQueueQuery,
  startCalibrationRunWorkflow,
} from "@repo/backend/convex/irt/helpers/queue";
import {
  completeCalibrationRunHandler,
  failCalibrationRunHandler,
} from "@repo/backend/convex/irt/helpers/runs";
import {
  IRT_CALIBRATION_QUEUE_BATCH_SIZE,
  IRT_CALIBRATION_RESPONSE_BACKFILL_BATCH_SIZE,
  IRT_MAX_CALIBRATION_STALENESS_MS,
  IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION,
  IRT_QUEUE_CLEANUP_BATCH_SIZE,
  IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE,
} from "@repo/backend/convex/irt/policy";
import { publishTryoutScaleVersionIfNeeded } from "@repo/backend/convex/irt/scales/publish";
import { irtCalibrationResultValidator } from "@repo/backend/convex/irt/validators";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { asyncMap } from "convex-helpers";

const backfillCalibrationResponsesResultValidator = v.object({
  isDone: v.boolean(),
  processedCount: v.number(),
});

const rebuildCalibrationCacheStatsResultValidator = v.object({
  isDone: v.boolean(),
  processedCount: v.number(),
});

/**
 * Syncs the denormalized calibration responses for one exercise attempt.
 */
export const syncCalibrationResponsesForAttempt = internalMutation({
  args: {
    attemptId: vv.id("exerciseAttempts"),
  },
  returns: v.null(),
  handler: (ctx, args) =>
    syncCalibrationResponsesForAttemptHandler(
      ctx,
      args,
      adjustCalibrationCacheAttemptCount
    ),
});

/** Rebuilds one set's calibration-cache stats in bounded pages. */
export const rebuildCalibrationCacheStatsForSet = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    progress: v.optional(calibrationCacheStatsRebuildProgressValidator),
    setId: vv.id("exerciseSets"),
  },
  returns: v.null(),
  handler: (ctx, args) => rebuildCalibrationCacheStatsForSetHandler(ctx, args),
});

/**
 * Backfills denormalized calibration responses for existing completed attempts.
 */
export const backfillCalibrationResponsesPage = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: backfillCalibrationResponsesResultValidator,
  handler: (ctx, args) =>
    backfillCalibrationResponsesPageHandler(
      ctx,
      args,
      IRT_CALIBRATION_RESPONSE_BACKFILL_BATCH_SIZE
    ),
});

/** Schedules bounded calibration-cache stats rebuilds for all exercise sets. */
export const rebuildCalibrationCacheStatsPage = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: rebuildCalibrationCacheStatsResultValidator,
  handler: (ctx, args) => rebuildCalibrationCacheStatsPageHandler(ctx, args),
});

/** Deletes the oldest cached calibration attempts until one set is back in budget. */
export const trimCalibrationCacheForSet = internalMutation({
  args: {
    setId: vv.id("exerciseSets"),
  },
  returns: v.null(),
  handler: (ctx, args) => trimCalibrationCacheForSetHandler(ctx, args),
});

/**
 * Drain a bounded batch of queued set calibrations.
 */
export const drainCalibrationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const queueEntries = await ctx.db
      .query("irtCalibrationQueue")
      .withIndex("by_enqueuedAt")
      .take(
        IRT_CALIBRATION_QUEUE_BATCH_SIZE *
          IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION
      );

    const distinctSetIds = [
      ...new Set(queueEntries.map((entry) => entry.setId)),
    ].slice(0, IRT_CALIBRATION_QUEUE_BATCH_SIZE);

    await asyncMap(distinctSetIds, async (setId) => {
      const cacheIsWithinLimit = await prepareCalibrationCacheForSet(
        ctx,
        setId
      );

      if (!cacheIsWithinLimit) {
        return null;
      }

      const [latestCompletedRun, latestRun] = await Promise.all([
        ctx.db
          .query("irtCalibrationRuns")
          .withIndex("by_setId_and_status_and_startedAt", (q) =>
            q.eq("setId", setId).eq("status", "completed")
          )
          .order("desc")
          .first(),
        ctx.db
          .query("irtCalibrationRuns")
          .withIndex("by_setId_and_startedAt", (q) => q.eq("setId", setId))
          .order("desc")
          .first(),
      ]);

      if (latestRun?.status === "running") {
        return null;
      }

      const lastSuccessfulRunStartedAt = latestCompletedRun?.startedAt;
      const pendingQueueEntries = await getPendingCalibrationQueueQuery(ctx, {
        lastSuccessfulRunStartedAt,
        setId,
      }).take(IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION);

      if (pendingQueueEntries.length === 0) {
        if (lastSuccessfulRunStartedAt !== undefined) {
          await ctx.scheduler.runAfter(
            0,
            internal.irt.internalMutations.cleanupCalibrationQueueEntries,
            {
              setId,
              throughAt: lastSuccessfulRunStartedAt,
            }
          );
        }

        return null;
      }

      const oldestPendingQueueEntry = pendingQueueEntries[0];

      if (!oldestPendingQueueEntry) {
        return null;
      }

      const hasEnoughCompletedAttempts =
        pendingQueueEntries.length >=
        IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION;
      const isStale =
        now - oldestPendingQueueEntry.enqueuedAt >=
        IRT_MAX_CALIBRATION_STALENESS_MS;

      if (!(hasEnoughCompletedAttempts || isStale)) {
        return null;
      }

      const calibrationRunId = await startCalibrationRunWorkflow(ctx, setId);

      if (!calibrationRunId) {
        return null;
      }

      return calibrationRunId;
    });

    return null;
  },
});

/**
 * Persist calibrated item parameters and mark the run completed.
 */
export const completeCalibrationRun = internalMutation({
  args: {
    calibrationRunId: vv.id("irtCalibrationRuns"),
    result: irtCalibrationResultValidator,
  },
  returns: v.null(),
  handler: (ctx, args) => completeCalibrationRunHandler(ctx, args),
});

/**
 * Mark a calibration run as failed and keep it eligible for retry.
 */
export const failCalibrationRun = internalMutation({
  args: {
    calibrationRunId: vv.id("irtCalibrationRuns"),
    error: v.string(),
  },
  returns: v.null(),
  handler: (ctx, args) => failCalibrationRunHandler(ctx, args),
});

/**
 * Deletes processed calibration queue rows in bounded batches.
 */
export const cleanupCalibrationQueueEntries = internalMutation({
  args: {
    setId: vv.id("exerciseSets"),
    throughAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletedCount = await cleanupCalibrationQueueEntriesBatch(ctx, args);

    if (deletedCount < IRT_QUEUE_CLEANUP_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.cleanupCalibrationQueueEntries,
      args
    );

    return null;
  },
});

/**
 * Deletes processed scale-publication queue rows in bounded batches.
 */
export const cleanupScalePublicationQueueEntries = internalMutation({
  args: {
    tryoutId: vv.id("tryouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletedCount = await cleanupScalePublicationQueueEntriesBatch(
      ctx,
      args.tryoutId
    );

    if (deletedCount < IRT_QUEUE_CLEANUP_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.cleanupScalePublicationQueueEntries,
      args
    );

    return null;
  },
});

/**
 * Drain a bounded batch of queued tryout scale publications.
 */
export const drainScalePublicationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const queueEntries = await ctx.db
      .query("irtScalePublicationQueue")
      .withIndex("by_enqueuedAt")
      .take(IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE);

    const distinctTryoutIds = [
      ...new Set(queueEntries.map((entry) => entry.tryoutId)),
    ];

    for (const tryoutId of distinctTryoutIds) {
      const result = await publishTryoutScaleVersionIfNeeded(ctx, tryoutId);

      if (result.kind === "not-ready") {
        continue;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.irt.internalMutations.cleanupScalePublicationQueueEntries,
        {
          tryoutId,
        }
      );
    }

    return null;
  },
});
