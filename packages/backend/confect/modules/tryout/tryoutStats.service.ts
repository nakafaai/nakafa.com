import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { tryoutProductPolicies } from "@repo/backend/confect/modules/tryout/products";
import { Duration, Effect, Option } from "effect";

const TRYOUT_STATS_REBUILD_BATCH_SIZE = 100;

interface TryoutStatsEntry {
  readonly completedAt: number;
  readonly rawScore: number;
  readonly theta: number;
}

interface TryoutStatsProgress {
  bestTheta?: number;
  lastTryoutAt: number;
  totalRawScore: number;
  totalTheta: number;
  totalTryoutsCompleted: number;
}

/** Rebuilds one user's aggregate stats from leaderboard entries. */
export const rebuildUserTryoutStats = Effect.fnUntraced(function* (args: {
  readonly cursor?: string;
  readonly leaderboardNamespace: string;
  readonly product: TryoutProduct;
  readonly progress?: TryoutStatsProgress;
  readonly userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const page = yield* reader
    .table("tryoutLeaderboardEntries")
    .index("by_userId_and_leaderboardNamespace_and_completedAt", (query) =>
      query
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
    progress.lastTryoutAt = Math.max(progress.lastTryoutAt, entry.completedAt);
    progress.totalRawScore += entry.rawScore;
    progress.totalTheta += entry.theta;
    progress.totalTryoutsCompleted += 1;
  }

  if (!page.isDone) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.tryouts.mutations.internalFunctions.stats
        .rebuildUserTryoutStats,
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

  const statsRecord = yield* reader
    .table("userTryoutStats")
    .index("by_userId_and_product_and_leaderboardNamespace", (query) =>
      query
        .eq("userId", args.userId)
        .eq("product", args.product)
        .eq("leaderboardNamespace", args.leaderboardNamespace)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (
    progress.totalTryoutsCompleted === 0 ||
    progress.bestTheta === undefined
  ) {
    if (statsRecord) {
      yield* writer.table("userTryoutStats").delete(statsRecord._id);
    }

    return null;
  }

  const nextStats = {
    averageRawScore: progress.totalRawScore / progress.totalTryoutsCompleted,
    averageTheta: progress.totalTheta / progress.totalTryoutsCompleted,
    bestTheta: progress.bestTheta,
    lastTryoutAt: progress.lastTryoutAt,
    totalTryoutsCompleted: progress.totalTryoutsCompleted,
  };

  if (statsRecord) {
    yield* writer.table("userTryoutStats").patch(statsRecord._id, {
      ...nextStats,
      updatedAt: progress.lastTryoutAt,
    });
    return null;
  }

  yield* writer.table("userTryoutStats").insert({
    ...nextStats,
    leaderboardNamespace: args.leaderboardNamespace,
    product: args.product,
    updatedAt: progress.lastTryoutAt,
    userId: args.userId,
  });

  return null;
});

/** Synchronizes one user's global tryout stats after a leaderboard change. */
export const syncUserTryoutStats = Effect.fnUntraced(function* (args: {
  readonly cycleKey: string;
  readonly locale: Locale;
  readonly nextEntry: TryoutStatsEntry;
  readonly previousEntry: TryoutStatsEntry | null;
  readonly product: TryoutProduct;
  readonly userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const leaderboardNamespace = tryoutProductPolicies[
    args.product
  ].getLeaderboardNamespace({
    cycleKey: args.cycleKey,
    locale: args.locale,
    product: args.product,
  });
  const statsRecord = yield* reader
    .table("userTryoutStats")
    .index("by_userId_and_product_and_leaderboardNamespace", (query) =>
      query
        .eq("userId", args.userId)
        .eq("product", args.product)
        .eq("leaderboardNamespace", leaderboardNamespace)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));
  const rebuildJob = {
    leaderboardNamespace,
    product: args.product,
    userId: args.userId,
  };

  if (!statsRecord) {
    if (args.previousEntry === null) {
      yield* writer.table("userTryoutStats").insert({
        averageRawScore: args.nextEntry.rawScore,
        averageTheta: args.nextEntry.theta,
        bestTheta: args.nextEntry.theta,
        lastTryoutAt: args.nextEntry.completedAt,
        leaderboardNamespace,
        product: args.product,
        totalTryoutsCompleted: 1,
        updatedAt: args.nextEntry.completedAt,
        userId: args.userId,
      });
      return null;
    }

    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.tryouts.mutations.internalFunctions.stats
        .rebuildUserTryoutStats,
      rebuildJob
    );
    return null;
  }

  const currentStats = statsRecord;
  const bestThetaWouldDrop =
    args.previousEntry !== null &&
    args.previousEntry.theta === currentStats.bestTheta &&
    args.nextEntry.theta < args.previousEntry.theta;
  const lastTryoutAtWouldDrop =
    args.previousEntry !== null &&
    args.previousEntry.completedAt === currentStats.lastTryoutAt &&
    args.nextEntry.completedAt < args.previousEntry.completedAt;
  const previousCount = currentStats.totalTryoutsCompleted;
  const totalTryoutsCompleted = args.previousEntry
    ? previousCount
    : previousCount + 1;
  const totalTheta =
    currentStats.averageTheta * previousCount -
    (args.previousEntry?.theta ?? 0) +
    args.nextEntry.theta;
  const totalRawScore =
    currentStats.averageRawScore * previousCount -
    (args.previousEntry?.rawScore ?? 0) +
    args.nextEntry.rawScore;
  let bestTheta = Math.max(currentStats.bestTheta, args.nextEntry.theta);
  let lastTryoutAt = Math.max(
    currentStats.lastTryoutAt,
    args.nextEntry.completedAt
  );
  const nextBestEntry = bestThetaWouldDrop
    ? yield* reader
        .table("tryoutLeaderboardEntries")
        .index(
          "by_userId_and_leaderboardNamespace_and_theta",
          (query) =>
            query
              .eq("userId", args.userId)
              .eq("leaderboardNamespace", leaderboardNamespace),
          "desc"
        )
        .first()
        .pipe(Effect.map(Option.getOrNull))
    : null;
  const latestEntry = lastTryoutAtWouldDrop
    ? yield* reader
        .table("tryoutLeaderboardEntries")
        .index(
          "by_userId_and_leaderboardNamespace_and_completedAt",
          (query) =>
            query
              .eq("userId", args.userId)
              .eq("leaderboardNamespace", leaderboardNamespace),
          "desc"
        )
        .first()
        .pipe(Effect.map(Option.getOrNull))
    : null;

  if (bestThetaWouldDrop && nextBestEntry) {
    bestTheta = nextBestEntry.theta;
  }

  if (lastTryoutAtWouldDrop && latestEntry) {
    lastTryoutAt = latestEntry.completedAt;
  }

  if (
    (bestThetaWouldDrop && !nextBestEntry) ||
    (lastTryoutAtWouldDrop && !latestEntry)
  ) {
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.tryouts.mutations.internalFunctions.stats
        .rebuildUserTryoutStats,
      rebuildJob
    );
    return null;
  }

  yield* writer.table("userTryoutStats").patch(currentStats._id, {
    averageRawScore: totalRawScore / totalTryoutsCompleted,
    averageTheta: totalTheta / totalTryoutsCompleted,
    bestTheta,
    lastTryoutAt,
    totalTryoutsCompleted,
    updatedAt: args.nextEntry.completedAt,
  });

  return null;
});
