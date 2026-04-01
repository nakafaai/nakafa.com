import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { prepareCalibrationCacheForSet } from "@repo/backend/convex/irt/helpers/cache";
import {
  cleanupCalibrationQueueEntriesBatch,
  cleanupScalePublicationQueueEntriesBatch,
  getPendingCalibrationQueueQuery,
  startCalibrationRunWorkflow,
} from "@repo/backend/convex/irt/helpers/queue";
import {
  IRT_CALIBRATION_QUEUE_BATCH_SIZE,
  IRT_MAX_CALIBRATION_STALENESS_MS,
  IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION,
  IRT_QUEUE_CLEANUP_BATCH_SIZE,
  IRT_QUEUE_SEALING_MS,
} from "@repo/backend/convex/irt/policy";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { asyncMap } from "convex-helpers";

/** Enqueue one tryout for scale publication. Duplicates are drained safely later. */
export const enqueueScalePublication = internalMutation({
  args: {
    tryoutId: vv.id("tryouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("irtScalePublicationQueue", {
      tryoutId: args.tryoutId,
      enqueuedAt: Date.now(),
    });

    return null;
  },
});

/** Drain one bounded batch of queued set calibrations. */
export const drainCalibrationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const sealedBeforeAt = now - IRT_QUEUE_SEALING_MS;
    const queueEntries = await ctx.db
      .query("irtCalibrationQueue")
      .withIndex("by_enqueuedAt", (q) => q.lt("enqueuedAt", sealedBeforeAt))
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
        sealedBeforeAt,
        setId,
      }).take(IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION);

      if (pendingQueueEntries.length === 0) {
        if (lastSuccessfulRunStartedAt !== undefined) {
          await ctx.scheduler.runAfter(
            0,
            internal.irt.mutations.internal.queue
              .cleanupCalibrationQueueEntries,
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

      return await startCalibrationRunWorkflow(ctx, setId);
    });

    return null;
  },
});

/** Delete processed calibration queue rows in bounded batches. */
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
      internal.irt.mutations.internal.queue.cleanupCalibrationQueueEntries,
      args
    );

    return null;
  },
});

/** Delete processed scale-publication queue rows in bounded batches. */
export const cleanupScalePublicationQueueEntries = internalMutation({
  args: {
    throughAt: v.number(),
    tryoutId: vv.id("tryouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletedCount = await cleanupScalePublicationQueueEntriesBatch(
      ctx,
      args
    );

    if (deletedCount < IRT_QUEUE_CLEANUP_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.irt.mutations.internal.queue.cleanupScalePublicationQueueEntries,
      args
    );

    return null;
  },
});
