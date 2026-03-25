import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { v } from "convex/values";

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

/** Rebuild one user's aggregate tryout stats in bounded pages. */
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
      .withIndex("by_userId_and_leaderboardNamespace_and_completedAt", (q) =>
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
        internal.tryouts.mutations.internal.stats.rebuildUserTryoutStats,
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
      .withIndex("by_userId_and_product_and_leaderboardNamespace", (q) =>
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
