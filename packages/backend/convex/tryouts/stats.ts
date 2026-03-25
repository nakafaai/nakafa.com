import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  type TryoutProduct,
  tryoutProductPolicies,
} from "@repo/backend/convex/tryouts/products";

type LeaderboardStatsEntry = Pick<
  Doc<"tryoutLeaderboardEntries">,
  "completedAt" | "rawScore" | "theta"
>;

/**
 * Incrementally update one user's aggregated tryout stats from a leaderboard row change.
 * Falls back to a bounded rebuild when the current aggregate can no longer be updated safely.
 */
export async function syncUserTryoutStats({
  cycleKey,
  ctx,
  locale,
  nextEntry,
  previousEntry,
  product,
  userId,
}: {
  cycleKey: Doc<"tryouts">["cycleKey"];
  ctx: Pick<MutationCtx, "db" | "scheduler">;
  locale: Doc<"tryouts">["locale"];
  nextEntry: LeaderboardStatsEntry;
  previousEntry: LeaderboardStatsEntry | null;
  product: TryoutProduct;
  userId: Id<"users">;
}) {
  const leaderboardNamespace = tryoutProductPolicies[
    product
  ].getLeaderboardNamespace({
    cycleKey,
    locale,
    product,
  });
  const statsRecord = await ctx.db
    .query("userTryoutStats")
    .withIndex("by_userId_and_product_and_leaderboardNamespace", (q) =>
      q
        .eq("userId", userId)
        .eq("product", product)
        .eq("leaderboardNamespace", leaderboardNamespace)
    )
    .unique();
  const rebuildJob = {
    leaderboardNamespace,
    product,
    userId,
  };

  if (!statsRecord) {
    if (previousEntry === null) {
      await ctx.db.insert("userTryoutStats", {
        averageRawScore: nextEntry.rawScore,
        averageTheta: nextEntry.theta,
        bestTheta: nextEntry.theta,
        lastTryoutAt: nextEntry.completedAt,
        leaderboardNamespace,
        product,
        totalTryoutsCompleted: 1,
        updatedAt: nextEntry.completedAt,
        userId,
      });

      return;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.tryouts.mutations.internal.stats.rebuildUserTryoutStats,
      rebuildJob
    );

    return;
  }

  const currentStats = statsRecord;

  const bestThetaWouldDrop =
    previousEntry !== null &&
    previousEntry.theta === currentStats.bestTheta &&
    nextEntry.theta < previousEntry.theta;
  const lastTryoutAtWouldDrop =
    previousEntry !== null &&
    previousEntry.completedAt === currentStats.lastTryoutAt &&
    nextEntry.completedAt < previousEntry.completedAt;

  const previousCount = currentStats.totalTryoutsCompleted;
  const totalTryoutsCompleted = previousEntry
    ? previousCount
    : previousCount + 1;
  const totalTheta =
    currentStats.averageTheta * previousCount -
    (previousEntry?.theta ?? 0) +
    nextEntry.theta;
  const totalRawScore =
    currentStats.averageRawScore * previousCount -
    (previousEntry?.rawScore ?? 0) +
    nextEntry.rawScore;
  let bestTheta = Math.max(currentStats.bestTheta, nextEntry.theta);
  let lastTryoutAt = Math.max(currentStats.lastTryoutAt, nextEntry.completedAt);
  const nextBestEntry = bestThetaWouldDrop
    ? await ctx.db
        .query("tryoutLeaderboardEntries")
        .withIndex("by_userId_and_leaderboardNamespace_and_theta", (q) =>
          q
            .eq("userId", userId)
            .eq("leaderboardNamespace", leaderboardNamespace)
        )
        .order("desc")
        .first()
    : null;
  const latestEntry = lastTryoutAtWouldDrop
    ? await ctx.db
        .query("tryoutLeaderboardEntries")
        .withIndex("by_userId_and_leaderboardNamespace_and_completedAt", (q) =>
          q
            .eq("userId", userId)
            .eq("leaderboardNamespace", leaderboardNamespace)
        )
        .order("desc")
        .first()
    : null;

  if (bestThetaWouldDrop && nextBestEntry) {
    bestTheta = nextBestEntry.theta;
  }

  if (lastTryoutAtWouldDrop && latestEntry) {
    lastTryoutAt = latestEntry.completedAt;
  }

  const needsRebuild =
    (bestThetaWouldDrop && !nextBestEntry) ||
    (lastTryoutAtWouldDrop && !latestEntry);

  if (needsRebuild) {
    await ctx.scheduler.runAfter(
      0,
      internal.tryouts.mutations.internal.stats.rebuildUserTryoutStats,
      rebuildJob
    );

    return;
  }

  await ctx.db.patch("userTryoutStats", currentStats._id, {
    totalTryoutsCompleted,
    averageTheta: totalTheta / totalTryoutsCompleted,
    bestTheta,
    averageRawScore: totalRawScore / totalTryoutsCompleted,
    lastTryoutAt,
    updatedAt: nextEntry.completedAt,
  });
}
