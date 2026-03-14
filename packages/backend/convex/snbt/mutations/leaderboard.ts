import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  computeSnbtRawScorePercentage,
  getFirstCompletedSimulationAttempt,
} from "@repo/backend/convex/snbt/helpers";
import { v } from "convex/values";

/**
 * Record the official first completed simulation attempt for a user on a try-out
 * and update locale/year-level SNBT stats from that official result.
 *
 * Later simulation retries remain visible to the user as results, but they are
 * unofficial and therefore do not overwrite the first official leaderboard row.
 */
export const updateLeaderboard = internalMutation({
  args: {
    tryoutAttemptId: vv.id("snbtTryoutAttempts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tryoutAttempt = await ctx.db.get(
      "snbtTryoutAttempts",
      args.tryoutAttemptId
    );
    if (!tryoutAttempt || tryoutAttempt.status !== "completed") {
      return null;
    }

    const tryout = await ctx.db.get("snbtTryouts", tryoutAttempt.tryoutId);

    if (!tryout) {
      throw new Error("Completed SNBT tryout attempt is missing its tryout.");
    }

    const firstCompletedAttempt = await getFirstCompletedSimulationAttempt(
      ctx.db,
      {
        userId: tryoutAttempt.userId,
        tryoutId: tryoutAttempt.tryoutId,
      }
    );

    if (firstCompletedAttempt?._id !== tryoutAttempt._id) {
      return null;
    }

    const existingEntry = await ctx.db
      .query("snbtLeaderboard")
      .withIndex("tryoutId_userId", (q) =>
        q
          .eq("tryoutId", tryoutAttempt.tryoutId)
          .eq("userId", tryoutAttempt.userId)
      )
      .unique();

    if (existingEntry) {
      return null;
    }

    const completedAt =
      tryoutAttempt.completedAt ?? tryoutAttempt.lastActivityAt;
    const rawScore = computeSnbtRawScorePercentage(tryoutAttempt);

    const entryData = {
      tryoutId: tryoutAttempt.tryoutId,
      userId: tryoutAttempt.userId,
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScore,
      completedAt,
      attemptId: tryoutAttempt._id,
    };

    await ctx.db.insert("snbtLeaderboard", entryData);

    const statsRecord = await ctx.db
      .query("userSnbtStats")
      .withIndex("userId_locale_year", (q) =>
        q
          .eq("userId", tryoutAttempt.userId)
          .eq("locale", tryout.locale)
          .eq("year", tryout.year)
      )
      .first();

    if (statsRecord) {
      const newTotal = statsRecord.totalTryoutsCompleted + 1;
      const newAverageTheta =
        (statsRecord.averageTheta * statsRecord.totalTryoutsCompleted +
          tryoutAttempt.theta) /
        newTotal;
      const newAverageThetaSE =
        (statsRecord.averageThetaSE * statsRecord.totalTryoutsCompleted +
          tryoutAttempt.thetaSE) /
        newTotal;
      const newAverageRawScore =
        (statsRecord.averageRawScore * statsRecord.totalTryoutsCompleted +
          rawScore) /
        newTotal;

      await ctx.db.patch("userSnbtStats", statsRecord._id, {
        totalTryoutsCompleted: newTotal,
        averageTheta: newAverageTheta,
        averageThetaSE: newAverageThetaSE,
        bestTheta: Math.max(statsRecord.bestTheta, tryoutAttempt.theta),
        averageRawScore: newAverageRawScore,
        bestRawScore: Math.max(statsRecord.bestRawScore, rawScore),
        lastTryoutAt: completedAt,
        updatedAt: completedAt,
      });
    } else {
      await ctx.db.insert("userSnbtStats", {
        userId: tryoutAttempt.userId,
        locale: tryout.locale,
        year: tryout.year,
        totalTryoutsCompleted: 1,
        averageTheta: tryoutAttempt.theta,
        averageThetaSE: tryoutAttempt.thetaSE,
        bestTheta: tryoutAttempt.theta,
        averageRawScore: rawScore,
        bestRawScore: rawScore,
        lastTryoutAt: completedAt,
        updatedAt: completedAt,
      });
    }

    return null;
  },
});
