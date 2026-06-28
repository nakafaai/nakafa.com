import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { getLatestCompletedCalibrationRunStartedAt } from "@repo/backend/convex/irt/integrity/impl";
import {
  calibrationCacheIntegrityPageResultValidator,
  calibrationQueueAttemptIntegrityPageResultValidator,
  calibrationQueueEntryIntegrityPageResultValidator,
  scaleQualityIntegrityPageResultValidator,
} from "@repo/backend/convex/irt/integrity/spec";
import { getCalibrationAttemptCacheLimit } from "@repo/backend/convex/irt/policy";
import { getLatestScaleVersionForTryout } from "@repo/backend/convex/irt/scales/read";
import { paginationOptsValidator } from "convex/server";

/**
 * Return the integrity totals for one bounded page of exercise sets.
 *
 * Operator scripts aggregate these page summaries client-side so each query stays
 * safely bounded as data grows.
 */
export const getCalibrationCacheIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: calibrationCacheIntegrityPageResultValidator,
  handler: async (ctx, args) => {
    const sets = await ctx.db
      .query("exerciseSets")
      .paginate(args.paginationOpts);

    let missingStatsSetCount = 0;
    let oversizedSetCount = 0;

    for (const set of sets.page) {
      const cacheStats = await ctx.db
        .query("irtCalibrationCacheStats")
        .withIndex("by_setId", (q) => q.eq("setId", set._id))
        .unique();

      if (!cacheStats) {
        const cachedAttempt = await ctx.db
          .query("irtCalibrationAttempts")
          .withIndex("by_setId", (q) => q.eq("setId", set._id))
          .first();

        if (cachedAttempt) {
          missingStatsSetCount += 1;
        }

        continue;
      }

      if (
        cacheStats.attemptCount <=
        getCalibrationAttemptCacheLimit(set.questionCount)
      ) {
        continue;
      }

      oversizedSetCount += 1;
    }

    return {
      continueCursor: sets.continueCursor,
      isDone: sets.isDone,
      missingStatsSetCount,
      oversizedSetCount,
    };
  },
});

/**
 * Return the integrity totals for one bounded page of active tryouts.
 *
 * Operator scripts aggregate these page summaries client-side so each query stays
 * safely bounded as data grows.
 */
export const getScaleQualityIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: scaleQualityIntegrityPageResultValidator,
  handler: async (ctx, args) => {
    const tryouts = await ctx.db
      .query("tryouts")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .paginate(args.paginationOpts);

    let missingQualityCheckTryoutCount = 0;
    let unstartableTryoutCount = 0;

    for (const tryout of tryouts.page) {
      const [qualityCheck, latestScaleVersion] = await Promise.all([
        ctx.db
          .query("irtScaleQualityChecks")
          .withIndex("by_tryoutId", (q) => q.eq("tryoutId", tryout._id))
          .unique(),
        getLatestScaleVersionForTryout(ctx.db, tryout._id),
      ]);

      if (!qualityCheck) {
        missingQualityCheckTryoutCount += 1;
      }

      if (!latestScaleVersion) {
        unstartableTryoutCount += 1;
      }
    }

    return {
      continueCursor: tryouts.continueCursor,
      isDone: tryouts.isDone,
      missingQualityCheckTryoutCount,
      unstartableTryoutCount,
    };
  },
});

/**
 * Return queue-integrity totals for one bounded page of cached calibration
 * attempts.
 */
export const getCalibrationQueueAttemptIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: calibrationQueueAttemptIntegrityPageResultValidator,
  handler: async (ctx, args) => {
    const attempts = await ctx.db
      .query("irtCalibrationAttempts")
      .paginate(args.paginationOpts);
    const latestCompletedRunStartedAtBySetId = new Map<
      Id<"exerciseSets">,
      number | undefined
    >();
    let duplicatePendingAttemptCount = 0;
    let missingPendingQueueAttemptCount = 0;
    let staleAttemptQueueSetCount = 0;

    for (const attempt of attempts.page) {
      const latestCompletedRunStartedAt =
        await getLatestCompletedCalibrationRunStartedAt(
          ctx,
          latestCompletedRunStartedAtBySetId,
          attempt.setId
        );

      if (
        latestCompletedRunStartedAt !== undefined &&
        attempt._creationTime <= latestCompletedRunStartedAt
      ) {
        continue;
      }

      const queueEntries = await ctx.db
        .query("irtCalibrationQueue")
        .withIndex("by_attemptId_and_enqueuedAt", (q) =>
          q.eq("attemptId", attempt.attemptId)
        )
        .take(2);

      if (queueEntries.length === 0) {
        missingPendingQueueAttemptCount += 1;
        continue;
      }

      if (queueEntries.length > 1) {
        duplicatePendingAttemptCount += 1;
        continue;
      }

      if (queueEntries[0]?.setId !== attempt.setId) {
        staleAttemptQueueSetCount += 1;
      }
    }

    return {
      continueCursor: attempts.continueCursor,
      duplicatePendingAttemptCount,
      isDone: attempts.isDone,
      missingPendingQueueAttemptCount,
      staleAttemptQueueSetCount,
    };
  },
});

/** Return queue-integrity totals for one bounded page of queue rows. */
export const getCalibrationQueueEntryIntegrity = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: calibrationQueueEntryIntegrityPageResultValidator,
  handler: async (ctx, args) => {
    const queueEntries = await ctx.db
      .query("irtCalibrationQueue")
      .withIndex("by_enqueuedAt")
      .paginate(args.paginationOpts);
    const latestCompletedRunStartedAtBySetId = new Map<
      Id<"exerciseSets">,
      number | undefined
    >();
    let orphanedQueueEntryCount = 0;
    let staleQueueEntryCount = 0;

    for (const queueEntry of queueEntries.page) {
      const queueAttemptId = queueEntry.attemptId;

      const attempt = await ctx.db
        .query("irtCalibrationAttempts")
        .withIndex("by_attemptId", (q) => q.eq("attemptId", queueAttemptId))
        .unique();

      if (!attempt || attempt.setId !== queueEntry.setId) {
        orphanedQueueEntryCount += 1;
        continue;
      }

      const latestCompletedRunStartedAt =
        await getLatestCompletedCalibrationRunStartedAt(
          ctx,
          latestCompletedRunStartedAtBySetId,
          queueEntry.setId
        );

      if (
        latestCompletedRunStartedAt !== undefined &&
        queueEntry.enqueuedAt <= latestCompletedRunStartedAt
      ) {
        staleQueueEntryCount += 1;
      }
    }

    return {
      continueCursor: queueEntries.continueCursor,
      isDone: queueEntries.isDone,
      orphanedQueueEntryCount,
      staleQueueEntryCount,
    };
  },
});
