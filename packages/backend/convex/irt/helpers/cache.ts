import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  getCalibrationAttemptCacheLimit,
  getCalibrationWindowStartAt,
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
      internal.irt.mutations.internal.cache.rebuildCalibrationCacheStatsForSet,
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
    internal.irt.mutations.internal.cache.trimCalibrationCacheForSet,
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
