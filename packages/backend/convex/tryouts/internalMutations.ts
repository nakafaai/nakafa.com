import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  computeTryoutRawScorePercentage,
  expireTryoutAttempt,
  isBetterLeaderboardScore,
  syncTryoutAttemptAggregates,
  syncTryoutAttemptExpiry,
} from "@repo/backend/convex/tryouts/helpers";
import {
  getTryoutLeaderboardNamespace,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { syncUserTryoutStats } from "@repo/backend/convex/tryouts/stats";
import { tryoutLeaderboardWorkpool } from "@repo/backend/convex/tryouts/workpool";
import { ConvexError, v } from "convex/values";

const TRYOUT_SCORE_PROMOTION_BATCH_SIZE = 100;
const TRYOUT_EXPIRY_SWEEP_BATCH_SIZE = 100;
const TRYOUT_STATS_REBUILD_BATCH_SIZE = 100;

type UserTryoutStatsSnapshot = Pick<
  Doc<"userTryoutStats">,
  | "averageRawScore"
  | "averageTheta"
  | "bestTheta"
  | "lastTryoutAt"
  | "totalTryoutsCompleted"
>;

const tryoutStatsRebuildProgressValidator = v.object({
  bestTheta: v.optional(v.number()),
  lastTryoutAt: v.number(),
  totalRawScore: v.number(),
  totalTheta: v.number(),
  totalTryoutsCompleted: v.number(),
});

/** Rebuilds one user's aggregate tryout stats in bounded pages. */
export const rebuildUserTryoutStats = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    leaderboardNamespace: v.string(),
    product: tryoutProductValidator,
    progress: v.optional(tryoutStatsRebuildProgressValidator),
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("tryoutLeaderboardEntries")
      .withIndex("userId_leaderboardNamespace_completedAt", (q) =>
        q
          .eq("userId", args.userId)
          .eq("leaderboardNamespace", args.leaderboardNamespace)
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: TRYOUT_STATS_REBUILD_BATCH_SIZE,
      });

    const progress = args.progress ?? {
      bestTheta: undefined,
      lastTryoutAt: 0,
      totalRawScore: 0,
      totalTheta: 0,
      totalTryoutsCompleted: 0,
    };

    for (const entry of page.page) {
      progress.bestTheta =
        progress.bestTheta === undefined
          ? entry.theta
          : Math.max(progress.bestTheta, entry.theta);
      progress.lastTryoutAt = Math.max(
        progress.lastTryoutAt,
        entry.completedAt
      );
      progress.totalRawScore += entry.rawScore;
      progress.totalTheta += entry.theta;
      progress.totalTryoutsCompleted += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.tryouts.internalMutations.rebuildUserTryoutStats,
        {
          cursor: page.continueCursor,
          leaderboardNamespace: args.leaderboardNamespace,
          product: args.product,
          progress,
          userId: args.userId,
        }
      );

      return null;
    }

    const statsRecord = await ctx.db
      .query("userTryoutStats")
      .withIndex("userId_product_leaderboardNamespace", (q) =>
        q
          .eq("userId", args.userId)
          .eq("product", args.product)
          .eq("leaderboardNamespace", args.leaderboardNamespace)
      )
      .unique();

    if (
      progress.totalTryoutsCompleted === 0 ||
      progress.bestTheta === undefined
    ) {
      if (statsRecord) {
        await ctx.db.delete("userTryoutStats", statsRecord._id);
      }

      return null;
    }

    const nextStats: UserTryoutStatsSnapshot = {
      averageRawScore: progress.totalRawScore / progress.totalTryoutsCompleted,
      averageTheta: progress.totalTheta / progress.totalTryoutsCompleted,
      bestTheta: progress.bestTheta,
      lastTryoutAt: progress.lastTryoutAt,
      totalTryoutsCompleted: progress.totalTryoutsCompleted,
    };

    if (statsRecord) {
      await ctx.db.patch("userTryoutStats", statsRecord._id, {
        ...nextStats,
        updatedAt: progress.lastTryoutAt,
      });

      return null;
    }

    await ctx.db.insert("userTryoutStats", {
      ...nextStats,
      leaderboardNamespace: args.leaderboardNamespace,
      product: args.product,
      updatedAt: progress.lastTryoutAt,
      userId: args.userId,
    });

    return null;
  },
});

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

    if (
      args.expiresAtMs < tryoutAttempt.expiresAt ||
      now < tryoutAttempt.expiresAt
    ) {
      return null;
    }

    await expireTryoutAttempt(ctx, tryoutAttempt, now);

    return null;
  },
});

/**
 * Repairs overdue in-progress tryouts in bounded batches.
 *
 * The exact expiry still comes from the per-attempt scheduled mutation. This
 * sweep only cleans up any overdue attempts whose scheduled expiration was
 * delayed or missed.
 */
export const sweepExpiredTryoutAttempts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const inProgressAttempts = await ctx.db
      .query("tryoutAttempts")
      .withIndex("status_expiresAt", (q) =>
        q.eq("status", "in-progress").lt("expiresAt", now + 1)
      )
      .take(TRYOUT_EXPIRY_SWEEP_BATCH_SIZE);

    for (const tryoutAttempt of inProgressAttempts) {
      await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);
    }

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
      tryoutAttempt.scoreStatus !== "official"
    ) {
      return null;
    }

    const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

    if (!tryout) {
      throw new ConvexError({
        code: "TRYOUT_NOT_FOUND",
        message: "Completed tryout attempt is missing its tryout.",
      });
    }

    const leaderboardNamespace = getTryoutLeaderboardNamespace({
      cycleKey: tryout.cycleKey,
      locale: tryout.locale,
      product: tryout.product,
    });
    const existingEntry = await ctx.db
      .query("tryoutLeaderboardEntries")
      .withIndex("tryoutId_userId", (q) =>
        q
          .eq("tryoutId", tryoutAttempt.tryoutId)
          .eq("userId", tryoutAttempt.userId)
      )
      .unique();

    if (
      existingEntry &&
      existingEntry.attemptId !== tryoutAttempt._id &&
      !isBetterLeaderboardScore(tryoutAttempt, existingEntry)
    ) {
      return null;
    }

    if (tryoutAttempt.completedAt === null) {
      throw new ConvexError({
        code: "TRYOUT_COMPLETED_AT_MISSING",
        message: "Completed tryout attempt is missing completedAt.",
      });
    }

    const completedAt = tryoutAttempt.completedAt;
    const rawScore = computeTryoutRawScorePercentage(tryoutAttempt);

    if (existingEntry) {
      await ctx.db.patch("tryoutLeaderboardEntries", existingEntry._id, {
        leaderboardNamespace,
        theta: tryoutAttempt.theta,
        thetaSE: tryoutAttempt.thetaSE,
        irtScore: tryoutAttempt.irtScore,
        rawScore,
        completedAt,
        attemptId: tryoutAttempt._id,
      });
    } else {
      await ctx.db.insert("tryoutLeaderboardEntries", {
        tryoutId: tryoutAttempt.tryoutId,
        userId: tryoutAttempt.userId,
        leaderboardNamespace,
        theta: tryoutAttempt.theta,
        thetaSE: tryoutAttempt.thetaSE,
        irtScore: tryoutAttempt.irtScore,
        rawScore,
        completedAt,
        attemptId: tryoutAttempt._id,
      });
    }

    await syncUserTryoutStats({
      cycleKey: tryout.cycleKey,
      ctx,
      locale: tryout.locale,
      nextEntry: {
        completedAt,
        rawScore,
        theta: tryoutAttempt.theta,
      },
      previousEntry: existingEntry
        ? {
            completedAt: existingEntry.completedAt,
            rawScore: existingEntry.rawScore,
            theta: existingEntry.theta,
          }
        : null,
      product: tryout.product,
      userId: tryoutAttempt.userId,
    });

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

    if (!scaleVersion || scaleVersion.status !== "official") {
      return null;
    }

    const completedAttempts = await ctx.db
      .query("tryoutAttempts")
      .withIndex("tryoutId_scoreStatus_status_startedAt", (q) =>
        q
          .eq("tryoutId", args.tryoutId)
          .eq("scoreStatus", "provisional")
          .eq("status", "completed")
      )
      .order("asc")
      .take(TRYOUT_SCORE_PROMOTION_BATCH_SIZE);

    const remainingSlots =
      TRYOUT_SCORE_PROMOTION_BATCH_SIZE - completedAttempts.length;
    const expiredAttempts =
      remainingSlots === 0
        ? []
        : await ctx.db
            .query("tryoutAttempts")
            .withIndex("tryoutId_scoreStatus_status_startedAt", (q) =>
              q
                .eq("tryoutId", args.tryoutId)
                .eq("scoreStatus", "provisional")
                .eq("status", "expired")
            )
            .order("asc")
            .take(remainingSlots);

    const provisionalAttempts = [...completedAttempts, ...expiredAttempts];

    if (provisionalAttempts.length === 0) {
      return null;
    }

    const now = Date.now();

    for (const tryoutAttempt of provisionalAttempts) {
      if (tryoutAttempt.status !== "in-progress") {
        await syncTryoutAttemptAggregates({
          completedAtMs: tryoutAttempt.completedAt ?? now,
          ctx,
          now,
          scaleVersionId: scaleVersion._id,
          scoreStatus: "official",
          status: tryoutAttempt.status,
          tryoutAttemptId: tryoutAttempt._id,
        });
      }

      if (tryoutAttempt.status !== "completed") {
        continue;
      }

      await tryoutLeaderboardWorkpool.enqueueMutation(
        ctx,
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
