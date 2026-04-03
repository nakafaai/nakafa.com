import { internalQuery } from "@repo/backend/convex/_generated/server";
import { getCalibrationAttemptCacheLimit } from "@repo/backend/convex/irt/policy";
import { getLatestScaleVersionForTryout } from "@repo/backend/convex/irt/scales/read";
import { ConvexError, v } from "convex/values";

const MAX_IRT_CACHE_INTEGRITY_SETS = 1000;

const calibrationCacheIntegrityResultValidator = v.object({
  missingStatsSetCount: v.number(),
  oversizedSetCount: v.number(),
});

const scaleQualityIntegrityResultValidator = v.object({
  missingQualityCheckTryoutCount: v.number(),
  unstartableTryoutCount: v.number(),
});

/**
 * Return whether any set still has missing or oversized calibration cache
 * state.
 *
 * Operator entrypoint: invoked via `convex run` / package scripts during manual
 * integrity verification.
 */
export const getCalibrationCacheIntegrity = internalQuery({
  args: {},
  returns: calibrationCacheIntegrityResultValidator,
  handler: async (ctx) => {
    const sets = await ctx.db
      .query("exerciseSets")
      .take(MAX_IRT_CACHE_INTEGRITY_SETS + 1);

    if (sets.length > MAX_IRT_CACHE_INTEGRITY_SETS) {
      throw new ConvexError({
        code: "IRT_CACHE_INTEGRITY_SET_LIMIT_EXCEEDED",
        message:
          "Too many exercise sets to scan calibration cache integrity safely.",
      });
    }

    let missingStatsSetCount = 0;
    let oversizedSetCount = 0;

    for (const set of sets) {
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
      missingStatsSetCount,
      oversizedSetCount,
    };
  },
});

/**
 * Return whether any active tryout is missing a quality check or missing a
 * frozen published scale.
 *
 * Operator entrypoint: invoked via `convex run` / package scripts during manual
 * integrity verification.
 */
export const getScaleQualityIntegrity = internalQuery({
  args: {},
  returns: scaleQualityIntegrityResultValidator,
  handler: async (ctx) => {
    const tryouts = await ctx.db
      .query("tryouts")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(MAX_IRT_CACHE_INTEGRITY_SETS + 1);

    if (tryouts.length > MAX_IRT_CACHE_INTEGRITY_SETS) {
      throw new ConvexError({
        code: "IRT_SCALE_QUALITY_TRYOUT_LIMIT_EXCEEDED",
        message: "Too many tryouts to scan scale quality safely.",
      });
    }

    let missingQualityCheckTryoutCount = 0;
    let unstartableTryoutCount = 0;

    for (const tryout of tryouts) {
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
      missingQualityCheckTryoutCount,
      unstartableTryoutCount,
    };
  },
});
