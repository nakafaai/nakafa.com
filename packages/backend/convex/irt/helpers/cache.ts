import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getCalibrationAttemptCacheLimit } from "@repo/backend/convex/irt/policy";
import { ConvexError, v } from "convex/values";

export const calibrationCacheStatsRebuildProgressValidator = v.object({
  attemptCount: v.number(),
});

export async function prepareCalibrationCacheForSet(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  setId: Id<"exerciseSets">
) {
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
    return true;
  }

  await ctx.scheduler.runAfter(
    0,
    internal.irt.internalMutations.trimCalibrationCacheForSet,
    { setId }
  );

  return false;
}

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
