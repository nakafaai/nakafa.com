import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  globalLeaderboard,
  tryoutLeaderboard,
} from "@repo/backend/convex/tryouts/aggregate";
import {
  getTryoutLeaderboardNamespace,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

export const getTryoutLeaderboard = query({
  args: {
    tryoutId: vv.id("tryouts"),
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

    const rankedItems = await Promise.all(
      Array.from({ length: Math.min(limit, totalCount) }, async (_, index) => {
        const item = await tryoutLeaderboard.at(ctx, index, {
          namespace: args.tryoutId,
        });

        if (!item) {
          return null;
        }

        return item;
      })
    );
    const aggregateItems = rankedItems.filter(isPresent);
    const leaderboardEntries = await getAll(
      ctx.db,
      "tryoutLeaderboardEntries",
      aggregateItems.map((item) => item.id)
    );
    const existingEntries = leaderboardEntries.filter(isPresent);
    const users = await getAll(
      ctx.db,
      "users",
      existingEntries.map((entry) => entry.userId)
    );

    return existingEntries.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      userName: users[index]?.name ?? "Unknown",
      theta: entry.theta,
      irtScore: entry.irtScore,
      rawScore: entry.rawScore,
      completedAt: entry.completedAt,
    }));
  },
});

export const getGlobalLeaderboard = query({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
    cycleKey: v.string(),
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
    const namespace = getTryoutLeaderboardNamespace(args);
    const totalCount = await globalLeaderboard.count(ctx, {
      namespace,
    });

    const rankedItems = await Promise.all(
      Array.from({ length: Math.min(limit, totalCount) }, async (_, index) => {
        const item = await globalLeaderboard.at(ctx, index, {
          namespace,
        });

        if (!item) {
          return null;
        }

        return item;
      })
    );
    const aggregateItems = rankedItems.filter(isPresent);
    const statsRecords = await getAll(
      ctx.db,
      "userTryoutStats",
      aggregateItems.map((item) => item.id)
    );
    const existingStats = statsRecords.filter(isPresent);
    const users = await getAll(
      ctx.db,
      "users",
      existingStats.map((stats) => stats.userId)
    );

    return existingStats.map((stats, index) => ({
      rank: index + 1,
      userId: stats.userId,
      userName: users[index]?.name ?? "Unknown",
      averageTheta: stats.averageTheta,
      totalTryoutsCompleted: stats.totalTryoutsCompleted,
      bestTheta: stats.bestTheta,
      averageRawScore: stats.averageRawScore,
      lastTryoutAt: stats.lastTryoutAt,
    }));
  },
});

export const getUserTryoutRank = query({
  args: {
    tryoutId: vv.id("tryouts"),
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
      .query("tryoutLeaderboardEntries")
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
      {
        namespace: args.tryoutId,
      }
    );
    const totalEntries = await tryoutLeaderboard.count(ctx, {
      namespace: args.tryoutId,
    });

    return { rank: index + 1, totalEntries };
  },
});
