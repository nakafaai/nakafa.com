import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { getScaleVersionStatus } from "@repo/backend/convex/irt/scaleVersions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  computeTryoutRawScorePercentage,
  expireTryoutAttempt,
  getFirstCompletedSimulationAttempt,
  getTryoutAttemptScoreStatus,
  rescoreTryoutAttempt,
} from "@repo/backend/convex/tryouts/helpers";
import {
  computeTryoutExpiresAtMs,
  getTryoutLeaderboardNamespace,
} from "@repo/backend/convex/tryouts/products";
import { v } from "convex/values";

const TRYOUT_SCORE_PROMOTION_BATCH_SIZE = 100;

/** Scheduler-safe expiry for one in-progress tryout attempt. */
export const expireTryoutAttemptInternal = internalMutation({
  args: {
    tryoutAttemptId: vv.id("tryoutAttempts"),
    expiresAtMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const tryoutAttempt = await ctx.db.get(
      "tryoutAttempts",
      args.tryoutAttemptId
    );

    if (!tryoutAttempt || tryoutAttempt.status !== "in-progress") {
      return null;
    }

    const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

    if (!tryout) {
      return null;
    }

    const computedExpiresAtMs = computeTryoutExpiresAtMs({
      product: tryout.product,
      startedAtMs: tryoutAttempt.startedAt,
    });

    if (args.expiresAtMs < computedExpiresAtMs || now < computedExpiresAtMs) {
      return null;
    }

    await expireTryoutAttempt(ctx, tryoutAttempt, now);

    return null;
  },
});

/** Upserts official leaderboard state after a completed tryout. */
export const updateLeaderboard = internalMutation({
  args: {
    tryoutAttemptId: vv.id("tryoutAttempts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tryoutAttempt = await ctx.db.get(
      "tryoutAttempts",
      args.tryoutAttemptId
    );

    if (
      !tryoutAttempt ||
      tryoutAttempt.status !== "completed" ||
      getTryoutAttemptScoreStatus(tryoutAttempt) !== "official"
    ) {
      return null;
    }

    const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

    if (!tryout) {
      throw new Error("Completed tryout attempt is missing its tryout.");
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
      .query("tryoutLeaderboardEntries")
      .withIndex("tryoutId_userId", (q) =>
        q
          .eq("tryoutId", tryoutAttempt.tryoutId)
          .eq("userId", tryoutAttempt.userId)
      )
      .unique();

    if (existingEntry) {
      return null;
    }

    if (tryoutAttempt.completedAt === null) {
      throw new Error("Completed tryout attempt is missing completedAt.");
    }

    const completedAt = tryoutAttempt.completedAt;
    const rawScore = computeTryoutRawScorePercentage(tryoutAttempt);

    await ctx.db.insert("tryoutLeaderboardEntries", {
      tryoutId: tryoutAttempt.tryoutId,
      userId: tryoutAttempt.userId,
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScore,
      completedAt,
      attemptId: tryoutAttempt._id,
    });

    const leaderboardNamespace = getTryoutLeaderboardNamespace({
      product: tryout.product,
      locale: tryout.locale,
      cycleKey: tryout.cycleKey,
    });
    const statsRecord = await ctx.db
      .query("userTryoutStats")
      .withIndex("userId_product_leaderboardNamespace", (q) =>
        q
          .eq("userId", tryoutAttempt.userId)
          .eq("product", tryout.product)
          .eq("leaderboardNamespace", leaderboardNamespace)
      )
      .unique();

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

      await ctx.db.patch("userTryoutStats", statsRecord._id, {
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
      await ctx.db.insert("userTryoutStats", {
        userId: tryoutAttempt.userId,
        product: tryout.product,
        leaderboardNamespace,
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

/** Promotes completed provisional tryout scores to one official frozen scale. */
export const promoteProvisionalTryoutScores = internalMutation({
  args: {
    tryoutId: vv.id("tryouts"),
    scaleVersionId: vv.id("irtScaleVersions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const scaleVersion = await ctx.db.get(
      "irtScaleVersions",
      args.scaleVersionId
    );

    if (!scaleVersion || getScaleVersionStatus(scaleVersion) !== "official") {
      return null;
    }

    const [completedAttempts, expiredAttempts] = await Promise.all([
      ctx.db
        .query("tryoutAttempts")
        .withIndex("tryoutId_scoreStatus_status_startedAt", (q) =>
          q
            .eq("tryoutId", args.tryoutId)
            .eq("scoreStatus", "provisional")
            .eq("status", "completed")
        )
        .order("asc")
        .take(TRYOUT_SCORE_PROMOTION_BATCH_SIZE),
      ctx.db
        .query("tryoutAttempts")
        .withIndex("tryoutId_scoreStatus_status_startedAt", (q) =>
          q
            .eq("tryoutId", args.tryoutId)
            .eq("scoreStatus", "provisional")
            .eq("status", "expired")
        )
        .order("asc")
        .take(TRYOUT_SCORE_PROMOTION_BATCH_SIZE),
    ]);

    const provisionalAttempts = [
      ...completedAttempts,
      ...expiredAttempts,
    ].slice(0, TRYOUT_SCORE_PROMOTION_BATCH_SIZE);

    if (provisionalAttempts.length === 0) {
      return null;
    }

    const now = Date.now();

    for (const tryoutAttempt of provisionalAttempts) {
      await rescoreTryoutAttempt({
        ctx,
        now,
        scaleVersionId: scaleVersion._id,
        scoreStatus: "official",
        tryoutAttempt,
      });

      if (tryoutAttempt.status !== "completed") {
        continue;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.tryouts.internalMutations.updateLeaderboard,
        {
          tryoutAttemptId: tryoutAttempt._id,
        }
      );
    }

    if (provisionalAttempts.length < TRYOUT_SCORE_PROMOTION_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.tryouts.internalMutations.promoteProvisionalTryoutScores,
      args
    );

    return null;
  },
});
