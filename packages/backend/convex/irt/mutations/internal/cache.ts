import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { calibrationCacheStatsRebuildProgressValidator } from "@repo/backend/convex/irt/helpers/cache";
import {
  getCalibrationAttemptCacheLimit,
  getCalibrationWindowStartAt,
  IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
  IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE,
} from "@repo/backend/convex/irt/policy";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Recount one set's cached calibration attempts in bounded pages and persist
 * the resulting cache-stats document.
 */
export const rebuildCalibrationCacheStatsForSet = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    progress: v.optional(calibrationCacheStatsRebuildProgressValidator),
    setId: vv.id("exerciseSets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const set = await ctx.db.get("exerciseSets", args.setId);

    if (!set) {
      return null;
    }

    const page = await ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId", (q) => q.eq("setId", args.setId))
      .paginate({
        cursor: args.cursor ?? null,
        numItems: IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
      });

    const progress = args.progress ?? { attemptCount: 0 };
    progress.attemptCount += page.page.length;

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.cache
          .rebuildCalibrationCacheStatsForSet,
        {
          cursor: page.continueCursor,
          progress,
          setId: args.setId,
        }
      );

      return null;
    }

    const cacheStats = await ctx.db
      .query("irtCalibrationCacheStats")
      .withIndex("by_setId", (q) => q.eq("setId", args.setId))
      .unique();

    if (progress.attemptCount === 0) {
      if (cacheStats) {
        await ctx.db.delete("irtCalibrationCacheStats", cacheStats._id);
      }

      return null;
    }

    if (cacheStats) {
      await ctx.db.patch("irtCalibrationCacheStats", cacheStats._id, {
        attemptCount: progress.attemptCount,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("irtCalibrationCacheStats", {
        setId: args.setId,
        attemptCount: progress.attemptCount,
        updatedAt: Date.now(),
      });
    }

    if (
      progress.attemptCount <=
      getCalibrationAttemptCacheLimit(set.questionCount)
    ) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.irt.mutations.internal.cache.trimCalibrationCacheForSet,
      { setId: args.setId }
    );

    return null;
  },
});

/**
 * Trim the oldest cached calibration attempts until one set fits both the live
 * time window and the operational cache-size limit.
 */
export const trimCalibrationCacheForSet = internalMutation({
  args: {
    setId: vv.id("exerciseSets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const set = await ctx.db.get("exerciseSets", args.setId);

    if (!set) {
      return null;
    }

    const cacheStats = await ctx.db
      .query("irtCalibrationCacheStats")
      .withIndex("by_setId", (q) => q.eq("setId", args.setId))
      .unique();

    if (!cacheStats) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.cache
          .rebuildCalibrationCacheStatsForSet,
        { setId: args.setId }
      );

      return null;
    }

    const cacheLimit = getCalibrationAttemptCacheLimit(set.questionCount);
    const oldestAttempts = await ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId", (q) => q.eq("setId", args.setId))
      .take(IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE);

    if (oldestAttempts.length === 0) {
      await ctx.db.delete("irtCalibrationCacheStats", cacheStats._id);
      return null;
    }

    const windowStartAt = getCalibrationWindowStartAt(now);
    const staleAttempts = oldestAttempts.filter(
      (attempt) => attempt._creationTime < windowStartAt
    );

    if (staleAttempts.length > 0) {
      for (const calibrationAttempt of staleAttempts) {
        await ctx.db.delete("irtCalibrationAttempts", calibrationAttempt._id);
      }

      const nextAttemptCount = Math.max(
        0,
        cacheStats.attemptCount - staleAttempts.length
      );

      if (nextAttemptCount === 0) {
        await ctx.db.delete("irtCalibrationCacheStats", cacheStats._id);
        return null;
      }

      await ctx.db.patch("irtCalibrationCacheStats", cacheStats._id, {
        attemptCount: nextAttemptCount,
        updatedAt: now,
      });

      if (
        staleAttempts.length < IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE &&
        nextAttemptCount <= cacheLimit
      ) {
        return null;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.irt.mutations.internal.cache.trimCalibrationCacheForSet,
        args
      );

      return null;
    }

    if (cacheStats.attemptCount <= cacheLimit) {
      return null;
    }

    const trimCount = Math.min(
      cacheStats.attemptCount - cacheLimit,
      IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE
    );
    const overflowAttempts = oldestAttempts.slice(0, trimCount);

    for (const calibrationAttempt of overflowAttempts) {
      await ctx.db.delete("irtCalibrationAttempts", calibrationAttempt._id);
    }

    const nextAttemptCount = Math.max(
      0,
      cacheStats.attemptCount - overflowAttempts.length
    );

    if (nextAttemptCount === 0) {
      await ctx.db.delete("irtCalibrationCacheStats", cacheStats._id);
      return null;
    }

    await ctx.db.patch("irtCalibrationCacheStats", cacheStats._id, {
      attemptCount: nextAttemptCount,
      updatedAt: now,
    });

    if (nextAttemptCount <= cacheLimit) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.irt.mutations.internal.cache.trimCalibrationCacheForSet,
      args
    );

    return null;
  },
});
