import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  globalLeaderboard,
  tryoutLeaderboard,
} from "@repo/backend/convex/snbt/aggregate";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Read the official leaderboard for a specific SNBT try-out.
 */
export const getTryoutLeaderboard = query({
  args: {
    tryoutId: vv.id("snbtTryouts"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      rank: v.number(),
      userId: vv.id("users"),
      userName: v.string(),
      theta: v.number(),
      irtScore: v.number(),
      rawScore: v.number(),
      completedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = Math.max(0, Math.min(args.limit ?? 50, 100));

    const totalCount = await tryoutLeaderboard.count(ctx, {
      namespace: args.tryoutId,
    });

    const rankedEntries = await Promise.all(
      Array.from({ length: Math.min(limit, totalCount) }, async (_, index) => {
        const item = await tryoutLeaderboard.at(ctx, index, {
          namespace: args.tryoutId,
        });

        if (!item) {
          return null;
        }

        const leaderboardEntry = await ctx.db.get("snbtLeaderboard", item.id);

        if (!leaderboardEntry) {
          return null;
        }

        const user = await ctx.db.get("users", leaderboardEntry.userId);

        return {
          rank: index + 1,
          userId: leaderboardEntry.userId,
          userName: user?.name ?? "Unknown",
          theta: leaderboardEntry.theta,
          irtScore: leaderboardEntry.irtScore,
          rawScore: leaderboardEntry.rawScore,
          completedAt: leaderboardEntry.completedAt,
        };
      })
    );

    return rankedEntries.filter((entry) => entry !== null);
  },
});

/**
 * Read the official year-scoped SNBT leaderboard for one locale.
 */
export const getGlobalLeaderboard = query({
  args: {
    locale: localeValidator,
    year: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      rank: v.number(),
      userId: vv.id("users"),
      userName: v.string(),
      averageTheta: v.number(),
      totalTryoutsCompleted: v.number(),
      bestTheta: v.number(),
      averageRawScore: v.number(),
      lastTryoutAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = Math.max(0, Math.min(args.limit ?? 50, 100));
    const namespace = `${args.locale}:${args.year}`;

    const totalCount = await globalLeaderboard.count(ctx, {
      namespace,
    });

    const rankedEntries = await Promise.all(
      Array.from({ length: Math.min(limit, totalCount) }, async (_, index) => {
        const item = await globalLeaderboard.at(ctx, index, {
          namespace,
        });

        if (!item) {
          return null;
        }

        const stats = await ctx.db.get("userSnbtStats", item.id);

        if (!stats) {
          return null;
        }

        const user = await ctx.db.get("users", stats.userId);

        return {
          rank: index + 1,
          userId: stats.userId,
          userName: user?.name ?? "Unknown",
          averageTheta: stats.averageTheta,
          totalTryoutsCompleted: stats.totalTryoutsCompleted,
          bestTheta: stats.bestTheta,
          averageRawScore: stats.averageRawScore,
          lastTryoutAt: stats.lastTryoutAt,
        };
      })
    );

    return rankedEntries.filter((entry) => entry !== null);
  },
});

/**
 * Get one user's rank inside an official try-out leaderboard.
 */
export const getUserTryoutRank = query({
  args: {
    tryoutId: vv.id("snbtTryouts"),
    userId: vv.id("users"),
  },
  returns: nullable(
    v.object({
      rank: v.number(),
      totalEntries: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("snbtLeaderboard")
      .withIndex("tryoutId_userId", (q) =>
        q.eq("tryoutId", args.tryoutId).eq("userId", args.userId)
      )
      .unique();

    if (!entry) {
      return null;
    }

    const index = await tryoutLeaderboard.indexOf(
      ctx,
      [-entry.theta, args.userId],
      { namespace: args.tryoutId }
    );

    const totalEntries = await tryoutLeaderboard.count(ctx, {
      namespace: args.tryoutId,
    });

    return { rank: index + 1, totalEntries };
  },
});
