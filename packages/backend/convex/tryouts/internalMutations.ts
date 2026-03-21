import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { getScaleVersionStatus } from "@repo/backend/convex/irt/scaleVersions";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  computeTryoutRawScorePercentage,
  expireTryoutAttempt,
  getTryoutAttemptScoreStatus,
  isBetterLeaderboardScore,
  rescoreTryoutAttempt,
} from "@repo/backend/convex/tryouts/helpers";
import {
  computeTryoutExpiresAtMs,
  getTryoutLeaderboardNamespace,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { tryoutLeaderboardWorkpool } from "@repo/backend/convex/tryouts/workpool";
import { ConvexError, v } from "convex/values";

const TRYOUT_SCORE_PROMOTION_BATCH_SIZE = 100;

type LeaderboardStatsEntry = Pick<
  Doc<"tryoutLeaderboardEntries">,
  "completedAt" | "rawScore" | "theta"
>;

async function buildUserTryoutStatsSnapshot({
  cycleKey,
  ctx,
  locale,
  product,
  userId,
}: {
  cycleKey: string;
  ctx: Pick<MutationCtx, "db">;
  locale: Doc<"tryouts">["locale"];
  product: Parameters<typeof getTryoutLeaderboardNamespace>[0]["product"];
  userId: Id<"users">;
}) {
  const leaderboardNamespace = getTryoutLeaderboardNamespace({
    cycleKey,
    locale,
    product,
  });
  const leaderboardEntries = ctx.db
    .query("tryoutLeaderboardEntries")
    .withIndex("userId_leaderboardNamespace", (q) =>
      q.eq("userId", userId).eq("leaderboardNamespace", leaderboardNamespace)
    );

  let totalTryoutsCompleted = 0;
  let totalTheta = 0;
  let totalRawScore = 0;
  let lastTryoutAt = 0;
  let bestTheta = Number.NEGATIVE_INFINITY;

  for await (const entry of leaderboardEntries) {
    totalTryoutsCompleted += 1;
    totalTheta += entry.theta;
    totalRawScore += entry.rawScore;
    lastTryoutAt = Math.max(lastTryoutAt, entry.completedAt);
    bestTheta = Math.max(bestTheta, entry.theta);
  }

  if (totalTryoutsCompleted === 0) {
    return null;
  }

  return {
    averageRawScore: totalRawScore / totalTryoutsCompleted,
    averageTheta: totalTheta / totalTryoutsCompleted,
    bestTheta,
    lastTryoutAt,
    totalTryoutsCompleted,
    updatedAt: lastTryoutAt,
  };
}

/** Updates one user's aggregate tryout stats from the changed canonical row. */
async function syncUserTryoutStats({
  cycleKey,
  ctx,
  locale,
  nextEntry,
  previousEntry,
  product,
  userId,
}: {
  cycleKey: string;
  ctx: Pick<MutationCtx, "db">;
  locale: Doc<"tryouts">["locale"];
  nextEntry: LeaderboardStatsEntry;
  previousEntry: LeaderboardStatsEntry | null;
  product: Parameters<typeof getTryoutLeaderboardNamespace>[0]["product"];
  userId: Id<"users">;
}) {
  const leaderboardNamespace = getTryoutLeaderboardNamespace({
    cycleKey,
    locale,
    product,
  });
  const statsRecord = await ctx.db
    .query("userTryoutStats")
    .withIndex("userId_product_leaderboardNamespace", (q) =>
      q
        .eq("userId", userId)
        .eq("product", product)
        .eq("leaderboardNamespace", leaderboardNamespace)
    )
    .unique();

  if (!statsRecord) {
    const rebuiltStats = await buildUserTryoutStatsSnapshot({
      cycleKey,
      ctx,
      locale,
      product,
      userId,
    });

    if (!rebuiltStats) {
      return;
    }

    await ctx.db.insert("userTryoutStats", {
      userId,
      product,
      leaderboardNamespace,
      ...rebuiltStats,
    });

    return;
  }

  const bestThetaWouldDrop =
    previousEntry !== null &&
    previousEntry.theta === statsRecord.bestTheta &&
    nextEntry.theta < previousEntry.theta;
  const lastTryoutAtWouldDrop =
    previousEntry !== null &&
    previousEntry.completedAt === statsRecord.lastTryoutAt &&
    nextEntry.completedAt < previousEntry.completedAt;

  if (bestThetaWouldDrop || lastTryoutAtWouldDrop) {
    const rebuiltStats = await buildUserTryoutStatsSnapshot({
      cycleKey,
      ctx,
      locale,
      product,
      userId,
    });

    if (!rebuiltStats) {
      await ctx.db.delete("userTryoutStats", statsRecord._id);
      return;
    }

    await ctx.db.patch("userTryoutStats", statsRecord._id, rebuiltStats);
    return;
  }

  const previousCount = statsRecord.totalTryoutsCompleted;
  const totalTryoutsCompleted = previousEntry
    ? previousCount
    : previousCount + 1;
  const totalTheta =
    statsRecord.averageTheta * previousCount -
    (previousEntry?.theta ?? 0) +
    nextEntry.theta;
  const totalRawScore =
    statsRecord.averageRawScore * previousCount -
    (previousEntry?.rawScore ?? 0) +
    nextEntry.rawScore;

  await ctx.db.patch("userTryoutStats", statsRecord._id, {
    totalTryoutsCompleted,
    averageTheta: totalTheta / totalTryoutsCompleted,
    bestTheta: Math.max(statsRecord.bestTheta, nextEntry.theta),
    averageRawScore: totalRawScore / totalTryoutsCompleted,
    lastTryoutAt: Math.max(statsRecord.lastTryoutAt, nextEntry.completedAt),
    updatedAt: nextEntry.completedAt,
  });
}

/** Rebuilds one user's aggregate tryout stats from canonical leaderboard rows. */
export const rebuildUserTryoutStats = internalMutation({
  args: {
    cycleKey: v.string(),
    locale: localeValidator,
    product: tryoutProductValidator,
    userId: vv.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const leaderboardNamespace = getTryoutLeaderboardNamespace({
      cycleKey: args.cycleKey,
      locale: args.locale,
      product: args.product,
    });
    const statsRecord = await ctx.db
      .query("userTryoutStats")
      .withIndex("userId_product_leaderboardNamespace", (q) =>
        q
          .eq("userId", args.userId)
          .eq("product", args.product)
          .eq("leaderboardNamespace", leaderboardNamespace)
      )
      .unique();
    const rebuiltStats = await buildUserTryoutStatsSnapshot({
      cycleKey: args.cycleKey,
      ctx,
      locale: args.locale,
      product: args.product,
      userId: args.userId,
    });

    if (!rebuiltStats) {
      if (statsRecord) {
        await ctx.db.delete("userTryoutStats", statsRecord._id);
      }

      return null;
    }

    if (statsRecord) {
      await ctx.db.patch("userTryoutStats", statsRecord._id, rebuiltStats);
      return null;
    }

    await ctx.db.insert("userTryoutStats", {
      userId: args.userId,
      product: args.product,
      leaderboardNamespace,
      ...rebuiltStats,
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

    if (!scaleVersion || getScaleVersionStatus(scaleVersion) !== "official") {
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
