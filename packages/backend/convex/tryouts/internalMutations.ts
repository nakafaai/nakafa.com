import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { getScaleVersionStatus } from "@repo/backend/convex/irt/scaleVersions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  computeTryoutRawScorePercentage,
  expireTryoutAttempt,
  getBestOfficialCompletedTryoutAttempt,
  getTryoutAttemptScoreStatus,
  rescoreTryoutAttempt,
} from "@repo/backend/convex/tryouts/helpers";
import {
  computeTryoutExpiresAtMs,
  getTryoutLeaderboardNamespace,
} from "@repo/backend/convex/tryouts/products";
import { v } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getAll } from "convex-helpers/server/relationships";

const TRYOUT_SCORE_PROMOTION_BATCH_SIZE = 100;

/** Recomputes one user's aggregate tryout stats from canonical leaderboard rows. */
async function syncUserTryoutStats({
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
  const tryouts = await ctx.db
    .query("tryouts")
    .withIndex("product_locale_cycleKey_slug", (q) =>
      q.eq("product", product).eq("locale", locale).eq("cycleKey", cycleKey)
    )
    .collect();
  const namespaceEntries = await asyncMap(tryouts, (tryout) =>
    ctx.db
      .query("tryoutLeaderboardEntries")
      .withIndex("tryoutId_userId", (q) =>
        q.eq("tryoutId", tryout._id).eq("userId", userId)
      )
      .unique()
  );
  const existingEntries = namespaceEntries.flatMap((entry) =>
    entry ? [entry] : []
  );
  const statsRecord = await ctx.db
    .query("userTryoutStats")
    .withIndex("userId_product_leaderboardNamespace", (q) =>
      q
        .eq("userId", userId)
        .eq("product", product)
        .eq("leaderboardNamespace", leaderboardNamespace)
    )
    .unique();

  if (existingEntries.length === 0) {
    if (statsRecord) {
      await ctx.db.delete("userTryoutStats", statsRecord._id);
    }

    return;
  }

  const totalTryoutsCompleted = existingEntries.length;
  const totalTheta = existingEntries.reduce(
    (sum, entry) => sum + entry.theta,
    0
  );
  const totalRawScore = existingEntries.reduce(
    (sum, entry) => sum + entry.rawScore,
    0
  );
  const latestCompletedAt = existingEntries.reduce(
    (latest, entry) => Math.max(latest, entry.completedAt),
    0
  );
  const bestTheta = existingEntries.reduce(
    (best, entry) => Math.max(best, entry.theta),
    Number.NEGATIVE_INFINITY
  );
  const bestRawScore = existingEntries.reduce(
    (best, entry) => Math.max(best, entry.rawScore),
    Number.NEGATIVE_INFINITY
  );
  const averageTheta = totalTheta / totalTryoutsCompleted;
  const averageRawScore = totalRawScore / totalTryoutsCompleted;

  const attemptIds = existingEntries.map((entry) => entry.attemptId);
  const attempts = await getAll(ctx.db, "tryoutAttempts", attemptIds);
  const averageThetaSE =
    attempts.reduce((sum, attempt) => sum + (attempt?.thetaSE ?? 0), 0) /
    totalTryoutsCompleted;

  if (statsRecord) {
    await ctx.db.patch("userTryoutStats", statsRecord._id, {
      totalTryoutsCompleted,
      averageTheta,
      averageThetaSE,
      bestTheta,
      averageRawScore,
      bestRawScore,
      lastTryoutAt: latestCompletedAt,
      updatedAt: latestCompletedAt,
    });
    return;
  }

  await ctx.db.insert("userTryoutStats", {
    userId,
    product,
    leaderboardNamespace,
    totalTryoutsCompleted,
    averageTheta,
    averageThetaSE,
    bestTheta,
    averageRawScore,
    bestRawScore,
    lastTryoutAt: latestCompletedAt,
    updatedAt: latestCompletedAt,
  });
}

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

    const bestOfficialAttempt = await getBestOfficialCompletedTryoutAttempt(
      ctx.db,
      {
        userId: tryoutAttempt.userId,
        tryoutId: tryoutAttempt.tryoutId,
      }
    );

    if (bestOfficialAttempt?._id !== tryoutAttempt._id) {
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

    if (tryoutAttempt.completedAt === null) {
      throw new Error("Completed tryout attempt is missing completedAt.");
    }

    const completedAt = tryoutAttempt.completedAt;
    const rawScore = computeTryoutRawScorePercentage(tryoutAttempt);

    if (existingEntry) {
      await ctx.db.patch("tryoutLeaderboardEntries", existingEntry._id, {
        theta: tryoutAttempt.theta,
        irtScore: tryoutAttempt.irtScore,
        rawScore,
        completedAt,
        attemptId: tryoutAttempt._id,
      });
    } else {
      await ctx.db.insert("tryoutLeaderboardEntries", {
        tryoutId: tryoutAttempt.tryoutId,
        userId: tryoutAttempt.userId,
        theta: tryoutAttempt.theta,
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
