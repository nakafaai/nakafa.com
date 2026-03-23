import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  getCalibrationAttemptCacheLimit,
  getCalibrationWindowStartAt,
  IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
  IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE,
} from "@repo/backend/convex/irt/policy";
import { ConvexError, v } from "convex/values";

export const calibrationCacheStatsRebuildProgressValidator = v.object({
  attemptCount: v.number(),
});

/** Ensures one set has cache stats and that its calibration cache stays in budget. */
export async function prepareCalibrationCacheForSet(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  setId: Id<"exerciseSets">
) {
  const now = Date.now();
  const set = await ctx.db.get("exerciseSets", setId);

  if (!set) {
    throw new ConvexError({
      code: "IRT_SET_NOT_FOUND",
      message: "Exercise set not found for calibration cache management.",
    });
  }

  const cacheStats = await ctx.db
    .query("irtCalibrationCacheStats")
    .withIndex("by_setId", (q) => q.eq("setId", setId))
    .unique();

  if (!cacheStats) {
    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
      { setId }
    );

    return false;
  }

  if (
    cacheStats.attemptCount <=
    getCalibrationAttemptCacheLimit(set.questionCount)
  ) {
    const oldestCachedAttempt = await ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId", (q) => q.eq("setId", setId))
      .first();

    if (
      !oldestCachedAttempt ||
      oldestCachedAttempt._creationTime >= getCalibrationWindowStartAt(now)
    ) {
      return true;
    }
  }

  await ctx.scheduler.runAfter(
    0,
    internal.irt.internalMutations.trimCalibrationCacheForSet,
    { setId }
  );

  return false;
}

/** Adjusts one set's cached attempt count after an insert or delete. */
export async function adjustCalibrationCacheAttemptCount(
  ctx: Pick<MutationCtx, "db">,
  {
    setId,
    delta,
    updatedAt,
  }: {
    setId: Id<"exerciseSets">;
    delta: number;
    updatedAt: number;
  }
) {
  if (delta === 0) {
    return false;
  }

  const cacheStats = await ctx.db
    .query("irtCalibrationCacheStats")
    .withIndex("by_setId", (q) => q.eq("setId", setId))
    .unique();

  if (!cacheStats) {
    return false;
  }

  const nextAttemptCount = Math.max(0, cacheStats.attemptCount + delta);

  if (nextAttemptCount === 0) {
    await ctx.db.delete("irtCalibrationCacheStats", cacheStats._id);
    return true;
  }

  await ctx.db.patch("irtCalibrationCacheStats", cacheStats._id, {
    attemptCount: nextAttemptCount,
    updatedAt,
  });

  return true;
}

/** Rebuilds one set's cache stats by paging over its cached calibration attempts. */
export async function rebuildCalibrationCacheStatsForSetHandler(
  ctx: MutationCtx,
  args: {
    cursor?: string;
    progress?: { attemptCount: number };
    setId: Id<"exerciseSets">;
  }
) {
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
      internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
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
    progress.attemptCount <= getCalibrationAttemptCacheLimit(set.questionCount)
  ) {
    return null;
  }

  await ctx.scheduler.runAfter(
    0,
    internal.irt.internalMutations.trimCalibrationCacheForSet,
    { setId: args.setId }
  );

  return null;
}

/** Schedules bounded cache-stat rebuilds for every exercise set. */
export async function rebuildCalibrationCacheStatsPageHandler(
  ctx: MutationCtx,
  args: {
    cursor?: string;
  }
) {
  const page = await ctx.db.query("exerciseSets").paginate({
    cursor: args.cursor ?? null,
    numItems: IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
  });

  for (const set of page.page) {
    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
      { setId: set._id }
    );
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.rebuildCalibrationCacheStatsPage,
      { cursor: page.continueCursor }
    );
  }

  return {
    isDone: page.isDone,
    processedCount: page.page.length,
  };
}

/** Trims the oldest cached calibration attempts until one set is back in budget. */
export async function trimCalibrationCacheForSetHandler(
  ctx: MutationCtx,
  args: {
    setId: Id<"exerciseSets">;
  }
) {
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
      internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
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
      internal.irt.internalMutations.trimCalibrationCacheForSet,
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
    internal.irt.internalMutations.trimCalibrationCacheForSet,
    args
  );

  return null;
}
