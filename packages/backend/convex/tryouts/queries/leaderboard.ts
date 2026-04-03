import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  globalLeaderboard,
  tryoutLeaderboard,
} from "@repo/backend/convex/tryouts/aggregate";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import {
  tryoutProductPolicies,
  tryoutProductValidator,
} from "@repo/backend/convex/tryouts/products";
import { ConvexError, v } from "convex/values";
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

/**
 * Hydrate ranked aggregate IDs back into table rows and aligned user names
 * while preserving the aggregate-provided ordering.
 */
async function loadLeaderboardRows<
  TableId extends Id<"tryoutLeaderboardEntries"> | Id<"userTryoutStats">,
  RecordDoc extends { userId: Id<"users"> },
  Row,
>({
  aggregateItems,
  ctx,
  loadRecords,
  mapRow,
}: {
  aggregateItems: { id: TableId }[];
  ctx: QueryCtx;
  loadRecords: (ids: TableId[]) => Promise<(RecordDoc | null)[]>;
  mapRow: (args: {
    rank: number;
    row: RecordDoc;
    userName: string | null;
  }) => Row;
}) {
  if (aggregateItems.length === 0) {
    return [];
  }

  const records = await loadRecords(aggregateItems.map((item) => item.id));
  const existingRows = records.flatMap((row) => (row ? [row] : []));

  if (existingRows.length === 0) {
    return [];
  }

  const users = await getAll(
    ctx.db,
    "users",
    existingRows.map((row) => row.userId)
  );

  return existingRows.map((row, index) =>
    mapRow({
      rank: index + 1,
      row,
      userName: users[index]?.name ?? null,
    })
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
    const limit = Math.max(
      0,
      Math.min(args.limit ?? DEFAULT_LEADERBOARD_LIMIT, MAX_LEADERBOARD_LIMIT)
    );

    if (limit === 0) {
      return [];
    }

    const tryout = await ctx.db.get("tryouts", args.tryoutId);

    if (!tryout) {
      throw new ConvexError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      });
    }

    const { page: aggregateItems } = await tryoutLeaderboard.paginate(ctx, {
      namespace: args.tryoutId,
      order: "asc",
      pageSize: limit,
    });

    return loadLeaderboardRows({
      aggregateItems,
      ctx,
      loadRecords: (ids) => getAll(ctx.db, "tryoutLeaderboardEntries", ids),
      mapRow: ({ rank, row, userName }) => ({
        rank,
        userId: row.userId,
        userName,
        theta: row.theta,
        irtScore: getTryoutReportScore(tryout.product, row.theta),
        rawScore: row.rawScore,
        completedAt: row.completedAt,
      }),
    });
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
    const limit = Math.max(
      0,
      Math.min(args.limit ?? DEFAULT_LEADERBOARD_LIMIT, MAX_LEADERBOARD_LIMIT)
    );

    if (limit === 0) {
      return [];
    }

    const namespace =
      tryoutProductPolicies[args.product].getLeaderboardNamespace(args);
    const { page: aggregateItems } = await globalLeaderboard.paginate(ctx, {
      namespace,
      order: "asc",
      pageSize: limit,
    });

    return loadLeaderboardRows({
      aggregateItems,
      ctx,
      loadRecords: (ids) => getAll(ctx.db, "userTryoutStats", ids),
      mapRow: ({ rank, row, userName }) => ({
        rank,
        userId: row.userId,
        userName,
        averageTheta: row.averageTheta,
        totalTryoutsCompleted: row.totalTryoutsCompleted,
        bestTheta: row.bestTheta,
        averageRawScore: row.averageRawScore,
        lastTryoutAt: row.lastTryoutAt,
      }),
    });
  },
});
