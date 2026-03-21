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

const DEFAULT_LEADERBOARD_LIMIT = 50;
const MAX_LEADERBOARD_LIMIT = 100;

const tryoutLeaderboardRowValidator = v.object({
  rank: v.number(),
  userId: vv.id("users"),
  userName: nullable(v.string()),
  theta: v.number(),
  irtScore: v.number(),
  rawScore: v.number(),
  completedAt: v.number(),
});

const globalLeaderboardRowValidator = v.object({
  rank: v.number(),
  userId: vv.id("users"),
  userName: nullable(v.string()),
  averageTheta: v.number(),
  totalTryoutsCompleted: v.number(),
  bestTheta: v.number(),
  averageRawScore: v.number(),
  lastTryoutAt: v.number(),
});

/** Keeps leaderboard list queries bounded and predictable. */
function resolveLeaderboardLimit(limit: number | undefined) {
  return Math.max(
    0,
    Math.min(limit ?? DEFAULT_LEADERBOARD_LIMIT, MAX_LEADERBOARD_LIMIT)
  );
}

/** Returns ranked official results for one concrete tryout. */
export const getTryoutLeaderboard = query({
  args: {
    tryoutId: vv.id("tryouts"),
    limit: v.optional(v.number()),
  },
  returns: v.array(tryoutLeaderboardRowValidator),
  handler: async (ctx, args) => {
    const limit = resolveLeaderboardLimit(args.limit);

    if (limit === 0) {
      return [];
    }

    const { page: aggregateItems } = await tryoutLeaderboard.paginate(ctx, {
      namespace: args.tryoutId,
      order: "asc",
      pageSize: limit,
    });

    if (aggregateItems.length === 0) {
      return [];
    }

    const leaderboardEntries = await getAll(
      ctx.db,
      "tryoutLeaderboardEntries",
      aggregateItems.map((item) => item.id)
    );
    const existingEntries = leaderboardEntries.flatMap((entry) =>
      entry ? [entry] : []
    );

    const users = await getAll(
      ctx.db,
      "users",
      existingEntries.map((entry) => entry.userId)
    );

    return existingEntries.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      userName: users[index]?.name ?? null,
      theta: entry.theta,
      irtScore: entry.irtScore,
      rawScore: entry.rawScore,
      completedAt: entry.completedAt,
    }));
  },
});

/** Returns ranked aggregate user stats for one product namespace. */
export const getGlobalLeaderboard = query({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
    cycleKey: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(globalLeaderboardRowValidator),
  handler: async (ctx, args) => {
    const limit = resolveLeaderboardLimit(args.limit);

    if (limit === 0) {
      return [];
    }

    const namespace = getTryoutLeaderboardNamespace(args);
    const { page: aggregateItems } = await globalLeaderboard.paginate(ctx, {
      namespace,
      order: "asc",
      pageSize: limit,
    });

    if (aggregateItems.length === 0) {
      return [];
    }

    const statsRecords = await getAll(
      ctx.db,
      "userTryoutStats",
      aggregateItems.map((item) => item.id)
    );
    const existingStats = statsRecords.flatMap((stats) =>
      stats ? [stats] : []
    );

    const users = await getAll(
      ctx.db,
      "users",
      existingStats.map((stats) => stats.userId)
    );

    return existingStats.map((stats, index) => ({
      rank: index + 1,
      userId: stats.userId,
      userName: users[index]?.name ?? null,
      averageTheta: stats.averageTheta,
      totalTryoutsCompleted: stats.totalTryoutsCompleted,
      bestTheta: stats.bestTheta,
      averageRawScore: stats.averageRawScore,
      lastTryoutAt: stats.lastTryoutAt,
    }));
  },
});

/** Returns one user's rank within a concrete tryout leaderboard. */
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
