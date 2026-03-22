import { internalQuery } from "@repo/backend/convex/_generated/server";
import { getCalibrationAttemptCacheLimit } from "@repo/backend/convex/irt/policy";
import { ConvexError, v } from "convex/values";

const MAX_IRT_CACHE_INTEGRITY_SETS = 1000;

const calibrationCacheIntegrityResultValidator = v.object({
  missingStatsSetCount: v.number(),
  oversizedSetCount: v.number(),
});

/** Returns whether any set still has missing or oversized calibration cache state. */
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
