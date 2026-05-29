import { GenericId } from "@confect/core";
import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
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
import { Effect, Option, Schema } from "effect";

const DEFAULT_LEADERBOARD_LIMIT = 50;
const MAX_LEADERBOARD_LIMIT = 100;
const decodeTryoutLeaderboardEntryId = Schema.decodeUnknownOption(
  GenericId.GenericId("tryoutLeaderboardEntries")
);
const decodeUserTryoutStatsId = Schema.decodeUnknownOption(
  GenericId.GenericId("userTryoutStats")
);

/** Normalizes leaderboard limits to the supported public range. */
function getLeaderboardLimit(limit?: number) {
  return Math.max(
    0,
    Math.min(limit ?? DEFAULT_LEADERBOARD_LIMIT, MAX_LEADERBOARD_LIMIT)
  );
}

/** Updates the per-tryout leaderboard for a completed official attempt. */
export const updateLeaderboard = Effect.fnUntraced(function* (args: {
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const attempt = yield* reader
    .table("tryoutAttempts")
    .get(args.tryoutAttemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (
    !attempt ||
    attempt.status !== "completed" ||
    attempt.scoreStatus !== "official"
  ) {
    return null;
  }

  const tryout = yield* reader
    .table("tryouts")
    .get(attempt.tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
  const existingEntry = yield* reader
    .table("tryoutLeaderboardEntries")
    .get("by_tryoutId_and_userId", attempt.tryoutId, attempt.userId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

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
    yield* writer.table("tryoutLeaderboardEntries").patch(existingEntry._id, {
      attemptId: attempt._id,
      completedAt,
      leaderboardNamespace,
      rawScore,
      theta: attempt.theta,
      thetaSE: attempt.thetaSE,
    });
  } else {
    yield* writer.table("tryoutLeaderboardEntries").insert({
      attemptId: attempt._id,
      completedAt,
      leaderboardNamespace,
      rawScore,
      theta: attempt.theta,
      thetaSE: attempt.thetaSE,
      tryoutId: attempt.tryoutId,
      userId: attempt.userId,
    });
  }

  yield* syncUserTryoutStats({
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
});

/** Reads the best scores for one tryout. */
export const getTryoutLeaderboard = Effect.fnUntraced(function* (args: {
  readonly limit?: number;
  readonly tryoutId: Id<"tryouts">;
}) {
  const ctx = yield* QueryCtx;
  const reader = yield* DatabaseReader;
  const limit = getLeaderboardLimit(args.limit);

  if (limit === 0) {
    return [];
  }

  const tryout = yield* reader
    .table("tryouts")
    .get(args.tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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

  const rowIds = aggregateItems.flatMap((item) =>
    Option.match(decodeTryoutLeaderboardEntryId(item.id), {
      onNone: () => [],
      onSome: (rowId) => [rowId],
    })
  );

  if (rowIds.length === 0) {
    return [];
  }

  const rows = yield* Effect.forEach(rowIds, (rowId) =>
    reader
      .table("tryoutLeaderboardEntries")
      .get(rowId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)))
  );
  const existingRows = rows.filter(
    (row): row is Doc<"tryoutLeaderboardEntries"> => row !== null
  );
  const users = yield* Effect.forEach(existingRows, (row) =>
    reader
      .table("users")
      .get(row.userId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)))
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
export const getGlobalLeaderboard = Effect.fnUntraced(function* (args: {
  readonly cycleKey: string;
  readonly limit?: number;
  readonly locale: Locale;
  readonly product: TryoutProduct;
}) {
  const ctx = yield* QueryCtx;
  const reader = yield* DatabaseReader;
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

  const rowIds = aggregateItems.flatMap((item) =>
    Option.match(decodeUserTryoutStatsId(item.id), {
      onNone: () => [],
      onSome: (rowId) => [rowId],
    })
  );

  if (rowIds.length === 0) {
    return [];
  }

  const rows = yield* Effect.forEach(rowIds, (rowId) =>
    reader
      .table("userTryoutStats")
      .get(rowId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)))
  );
  const existingRows = rows.filter(
    (row): row is Doc<"userTryoutStats"> => row !== null
  );
  const users = yield* Effect.forEach(existingRows, (row) =>
    reader
      .table("users")
      .get(row.userId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)))
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
