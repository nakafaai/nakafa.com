import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import {
  type TryoutProduct,
  tryoutProductPolicies,
} from "@repo/backend/confect/modules/tryout/products";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import {
  globalLeaderboard,
  tryoutLeaderboard,
} from "@repo/backend/confect/modules/tryout/tryoutAggregates";
import {
  computeTryoutRawScorePercentage,
  isBetterLeaderboardScore,
} from "@repo/backend/confect/modules/tryout/tryoutMetrics.service";
import { getTryoutReportScore } from "@repo/backend/confect/modules/tryout/tryoutReporting.service";
import { syncUserTryoutStats } from "@repo/backend/confect/modules/tryout/tryoutStats.service";
import { getAll } from "convex-helpers/server/relationships";
import { Effect } from "effect";

const DEFAULT_LEADERBOARD_LIMIT = 50;
const MAX_LEADERBOARD_LIMIT = 100;

/** Normalizes leaderboard limits to the supported public range. */
function getLeaderboardLimit(limit?: number) {
  return Math.max(
    0,
    Math.min(limit ?? DEFAULT_LEADERBOARD_LIMIT, MAX_LEADERBOARD_LIMIT)
  );
}

/** Updates the per-tryout leaderboard for a completed official attempt. */
export const updateLeaderboard = Effect.fn("tryouts.leaderboard.update")(
  function* (args: { readonly tryoutAttemptId: Id<"tryoutAttempts"> }) {
    const ctx = yield* MutationCtx;
    const attempt = yield* Effect.promise(() =>
      ctx.db.get(args.tryoutAttemptId)
    );

    if (
      !attempt ||
      attempt.status !== "completed" ||
      attempt.scoreStatus !== "official"
    ) {
      return null;
    }

    const tryout = yield* Effect.promise(() => ctx.db.get(attempt.tryoutId));

    if (!tryout) {
      return yield* Effect.fail(
        new TryoutError({
          code: "TRYOUT_NOT_FOUND",
          message: "Completed tryout attempt is missing its tryout.",
        })
      );
    }

    if (attempt.completedAt === null) {
      return yield* Effect.fail(
        new TryoutError({
          code: "TRYOUT_COMPLETED_AT_MISSING",
          message: "Completed tryout attempt is missing completedAt.",
        })
      );
    }

    const leaderboardNamespace = tryoutProductPolicies[
      tryout.product
    ].getLeaderboardNamespace({
      cycleKey: tryout.cycleKey,
      locale: tryout.locale,
      product: tryout.product,
    });
    const existingEntry = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutLeaderboardEntries")
        .withIndex("by_tryoutId_and_userId", (query) =>
          query.eq("tryoutId", attempt.tryoutId).eq("userId", attempt.userId)
        )
        .unique()
    );

    if (
      existingEntry &&
      existingEntry.attemptId !== attempt._id &&
      !isBetterLeaderboardScore(attempt, existingEntry)
    ) {
      return null;
    }

    const completedAt = attempt.completedAt;
    const rawScore = computeTryoutRawScorePercentage(attempt);

    if (existingEntry) {
      yield* Effect.promise(() =>
        ctx.db.patch(existingEntry._id, {
          attemptId: attempt._id,
          completedAt,
          leaderboardNamespace,
          rawScore,
          theta: attempt.theta,
          thetaSE: attempt.thetaSE,
        })
      );
    } else {
      yield* Effect.promise(() =>
        ctx.db.insert("tryoutLeaderboardEntries", {
          attemptId: attempt._id,
          completedAt,
          leaderboardNamespace,
          rawScore,
          theta: attempt.theta,
          thetaSE: attempt.thetaSE,
          tryoutId: attempt.tryoutId,
          userId: attempt.userId,
        })
      );
    }

    yield* syncUserTryoutStats({
      ctx,
      cycleKey: tryout.cycleKey,
      locale: tryout.locale,
      nextEntry: {
        completedAt,
        rawScore,
        theta: attempt.theta,
      },
      previousEntry: existingEntry
        ? {
            completedAt: existingEntry.completedAt,
            rawScore: existingEntry.rawScore,
            theta: existingEntry.theta,
          }
        : null,
      product: tryout.product,
      userId: attempt.userId,
    });

    return null;
  }
);

/** Reads the best scores for one tryout. */
export const getTryoutLeaderboard = Effect.fn(
  "tryouts.leaderboard.getTryoutLeaderboard"
)(function* (args: {
  readonly limit?: number;
  readonly tryoutId: Id<"tryouts">;
}) {
  const ctx = yield* QueryCtx;
  const limit = getLeaderboardLimit(args.limit);

  if (limit === 0) {
    return [];
  }

  const tryout = yield* Effect.promise(() => ctx.db.get(args.tryoutId));

  if (!tryout) {
    return yield* Effect.fail(
      new TryoutError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      })
    );
  }

  const { page: aggregateItems } = yield* Effect.promise(() =>
    tryoutLeaderboard.paginate(ctx, {
      namespace: args.tryoutId,
      order: "asc",
      pageSize: limit,
    })
  );

  if (aggregateItems.length === 0) {
    return [];
  }

  const rowIds = aggregateItems.flatMap((item) => {
    const rowId = ctx.db.normalizeId("tryoutLeaderboardEntries", item.id);
    return rowId ? [rowId] : [];
  });

  if (rowIds.length === 0) {
    return [];
  }

  const rows = yield* Effect.promise(() =>
    getAll(ctx.db, "tryoutLeaderboardEntries", rowIds)
  );
  const existingRows = rows.filter(
    (row): row is Doc<"tryoutLeaderboardEntries"> => row !== null
  );
  const users = yield* Effect.promise(() =>
    getAll(
      ctx.db,
      "users",
      existingRows.map((row) => row.userId)
    )
  );

  return existingRows.map((row, index) => ({
    completedAt: row.completedAt,
    irtScore: getTryoutReportScore(tryout.product, row.theta),
    rank: index + 1,
    rawScore: row.rawScore,
    theta: row.theta,
    userId: row.userId,
    userName: users[index]?.name ?? null,
  }));
});

/** Reads the global leaderboard for a product/cycle namespace. */
export const getGlobalLeaderboard = Effect.fn(
  "tryouts.leaderboard.getGlobalLeaderboard"
)(function* (args: {
  readonly cycleKey: string;
  readonly limit?: number;
  readonly locale: Locale;
  readonly product: TryoutProduct;
}) {
  const ctx = yield* QueryCtx;
  const limit = getLeaderboardLimit(args.limit);

  if (limit === 0) {
    return [];
  }

  const namespace =
    tryoutProductPolicies[args.product].getLeaderboardNamespace(args);
  const { page: aggregateItems } = yield* Effect.promise(() =>
    globalLeaderboard.paginate(ctx, {
      namespace,
      order: "asc",
      pageSize: limit,
    })
  );

  if (aggregateItems.length === 0) {
    return [];
  }

  const rowIds = aggregateItems.flatMap((item) => {
    const rowId = ctx.db.normalizeId("userTryoutStats", item.id);
    return rowId ? [rowId] : [];
  });

  if (rowIds.length === 0) {
    return [];
  }

  const rows = yield* Effect.promise(() =>
    getAll(ctx.db, "userTryoutStats", rowIds)
  );
  const existingRows = rows.filter(
    (row): row is Doc<"userTryoutStats"> => row !== null
  );
  const users = yield* Effect.promise(() =>
    getAll(
      ctx.db,
      "users",
      existingRows.map((row) => row.userId)
    )
  );

  return existingRows.map((row, index) => ({
    averageRawScore: row.averageRawScore,
    averageTheta: row.averageTheta,
    bestTheta: row.bestTheta,
    lastTryoutAt: row.lastTryoutAt,
    rank: index + 1,
    totalTryoutsCompleted: row.totalTryoutsCompleted,
    userId: row.userId,
    userName: users[index]?.name ?? null,
  }));
});
