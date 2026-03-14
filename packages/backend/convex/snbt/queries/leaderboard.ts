import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  globalLeaderboard,
  tryoutLeaderboard,
} from "@repo/backend/convex/snbt/aggregate";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

export const getTryoutLeaderboard = query({
  args: {
    locale: localeValidator,
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
    const limit = Math.min(args.limit ?? 50, 100);

    const totalCount = await tryoutLeaderboard.count(ctx, {
      namespace: args.tryoutId,
    });

    const results: Array<{
      rank: number;
      userId: Id<"users">;
      userName: string;
      theta: number;
      irtScore: number;
      rawScore: number;
      completedAt: number;
    }> = [];

    for (let i = 0; i < Math.min(limit, totalCount); i++) {
      const item = await tryoutLeaderboard.at(ctx, i, {
        namespace: args.tryoutId,
      });
      if (!item) {
        break;
      }

      const leaderboardEntry = await ctx.db.get(item.id);
      if (!leaderboardEntry) {
        continue;
      }

      const user = await ctx.db.get(leaderboardEntry.userId);
      results.push({
        rank: i + 1,
        userId: leaderboardEntry.userId,
        userName: user?.name ?? "Unknown",
        theta: leaderboardEntry.theta,
        irtScore: leaderboardEntry.irtScore,
        rawScore: leaderboardEntry.rawScore,
        completedAt: leaderboardEntry.completedAt,
      });
    }

    return results;
  },
});

export const getGlobalLeaderboard = query({
  args: {
    locale: localeValidator,
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
    const limit = Math.min(args.limit ?? 50, 100);

    const totalCount = await globalLeaderboard.count(ctx, {
      namespace: args.locale,
    });

    const results: Array<{
      rank: number;
      userId: Id<"users">;
      userName: string;
      averageTheta: number;
      totalTryoutsCompleted: number;
      bestTheta: number;
      averageRawScore: number;
      lastTryoutAt: number;
    }> = [];

    for (let i = 0; i < Math.min(limit, totalCount); i++) {
      const item = await globalLeaderboard.at(ctx, i, {
        namespace: args.locale,
      });
      if (!item) {
        break;
      }

      const stats = await ctx.db.get(item.id);
      if (!stats) {
        continue;
      }

      const user = await ctx.db.get(stats.userId);
      results.push({
        rank: i + 1,
        userId: stats.userId,
        userName: user?.name ?? "Unknown",
        averageTheta: stats.averageTheta,
        totalTryoutsCompleted: stats.totalTryoutsCompleted,
        bestTheta: stats.bestTheta,
        averageRawScore: stats.averageRawScore,
        lastTryoutAt: stats.lastTryoutAt,
      });
    }

    return results;
  },
});

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
      .first();

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
