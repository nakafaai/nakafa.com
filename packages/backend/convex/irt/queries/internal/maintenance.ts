import { internalQuery } from "@repo/backend/convex/_generated/server";
import { getCalibrationAttemptCacheLimit } from "@repo/backend/convex/irt/policy";
import { getLatestScaleVersionForTryout } from "@repo/backend/convex/irt/scales/read";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

const calibrationCacheIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  missingStatsSetCount: v.number(),
  oversizedSetCount: v.number(),
});

const scaleQualityIntegrityPageResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  missingQualityCheckTryoutCount: v.number(),
  unstartableTryoutCount: v.number(),
});

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
