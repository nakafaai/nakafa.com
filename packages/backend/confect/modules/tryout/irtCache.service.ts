import { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import {
  getCalibrationAttemptCacheLimit,
  getCalibrationWindowStartAt,
  IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
  IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import { Clock, Effect } from "effect";

/** Schedules a calibration cache stats rebuild for one exercise set. */
export function scheduleCalibrationCacheStatsRebuild(
  ctx: ConvexMutationCtx,
  setId: Id<"exerciseSets">
) {
  return Effect.promise(() =>
    ctx.scheduler.runAfter(
      0,
      Ref.getFunctionReference(
        refs.internal.irt.mutations.internalFunctions.cache
          .rebuildCalibrationCacheStatsForSet
      ),
      { setId }
    )
  );
}

/** Schedules calibration cache trimming for one exercise set. */
export function scheduleCalibrationCacheTrim(
  ctx: ConvexMutationCtx,
  setId: Id<"exerciseSets">
) {
  return Effect.promise(() =>
    ctx.scheduler.runAfter(
      0,
      Ref.getFunctionReference(
        refs.internal.irt.mutations.internalFunctions.cache
          .trimCalibrationCacheForSet
      ),
      { setId }
    )
  );
}

/** Ensures a set's calibration cache is within bounded processing limits. */
export const prepareCalibrationCacheForSet = Effect.fn(
  "irt.cache.prepareCalibrationCacheForSet"
)(function* (ctx: ConvexMutationCtx, setId: Id<"exerciseSets">) {
  const now = yield* Clock.currentTimeMillis;
  const set = yield* Effect.promise(() => ctx.db.get(setId));

  if (!set) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_SET_NOT_FOUND",
        message: "Exercise set not found for calibration cache management.",
      })
    );
  }

  const cacheStats = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationCacheStats")
      .withIndex("by_setId", (query) => query.eq("setId", setId))
      .unique()
  );

  if (!cacheStats) {
    yield* scheduleCalibrationCacheStatsRebuild(ctx, setId);
    return false;
  }

  if (
    cacheStats.attemptCount <=
    getCalibrationAttemptCacheLimit(set.questionCount)
  ) {
    const oldestCachedAttempt = yield* Effect.promise(() =>
      ctx.db
        .query("irtCalibrationAttempts")
        .withIndex("by_setId", (query) => query.eq("setId", setId))
        .first()
    );

    if (
      !oldestCachedAttempt ||
      oldestCachedAttempt._creationTime >= getCalibrationWindowStartAt(now)
    ) {
      return true;
    }
  }

  yield* scheduleCalibrationCacheTrim(ctx, setId);
  return false;
});

/** Adjusts cached attempt stats after cache row insertion or deletion. */
export const adjustCalibrationCacheAttemptCount = Effect.fn(
  "irt.cache.adjustCalibrationCacheAttemptCount"
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly delta: number;
    readonly setId: Id<"exerciseSets">;
    readonly updatedAt: number;
  }
) {
  if (args.delta === 0) {
    return false;
  }

  const cacheStats = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationCacheStats")
      .withIndex("by_setId", (query) => query.eq("setId", args.setId))
      .unique()
  );

  if (!cacheStats) {
    return false;
  }

  const nextAttemptCount = Math.max(0, cacheStats.attemptCount + args.delta);

  if (nextAttemptCount === 0) {
    yield* Effect.promise(() => ctx.db.delete(cacheStats._id));
    return true;
  }

  yield* Effect.promise(() =>
    ctx.db.patch(cacheStats._id, {
      attemptCount: nextAttemptCount,
      updatedAt: args.updatedAt,
    })
  );

  return true;
});

/** Rebuilds cache stats for one set through paginated mutation batches. */
export const rebuildCalibrationCacheStatsForSet = Effect.fn(
  "irt.cache.rebuildCalibrationCacheStatsForSet"
)(function* (args: {
  readonly cursor?: string;
  readonly progress?: { readonly attemptCount: number };
  readonly setId: Id<"exerciseSets">;
}) {
  const ctx = yield* MutationCtx;
  const set = yield* Effect.promise(() => ctx.db.get(args.setId));

  if (!set) {
    return null;
  }

  const page = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId", (query) => query.eq("setId", args.setId))
      .paginate({
        cursor: args.cursor ?? null,
        numItems: IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
      })
  );
  const progress = {
    attemptCount: (args.progress?.attemptCount ?? 0) + page.page.length,
  };

  if (!page.isDone) {
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        0,
        Ref.getFunctionReference(
          refs.internal.irt.mutations.internalFunctions.cache
            .rebuildCalibrationCacheStatsForSet
        ),
        {
          cursor: page.continueCursor,
          progress,
          setId: args.setId,
        }
      )
    );
    return null;
  }

  const cacheStats = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationCacheStats")
      .withIndex("by_setId", (query) => query.eq("setId", args.setId))
      .unique()
  );

  if (progress.attemptCount === 0) {
    if (cacheStats) {
      yield* Effect.promise(() => ctx.db.delete(cacheStats._id));
    }

    return null;
  }

  const now = yield* Clock.currentTimeMillis;

  if (cacheStats) {
    yield* Effect.promise(() =>
      ctx.db.patch(cacheStats._id, {
        attemptCount: progress.attemptCount,
        updatedAt: now,
      })
    );
  } else {
    yield* Effect.promise(() =>
      ctx.db.insert("irtCalibrationCacheStats", {
        attemptCount: progress.attemptCount,
        setId: args.setId,
        updatedAt: now,
      })
    );
  }

  if (
    progress.attemptCount <= getCalibrationAttemptCacheLimit(set.questionCount)
  ) {
    return null;
  }

  yield* scheduleCalibrationCacheTrim(ctx, args.setId);
  return null;
});

/** Trims stale or overflow calibration cache rows for one set. */
export const trimCalibrationCacheForSet = Effect.fn(
  "irt.cache.trimCalibrationCacheForSet"
)(function* (args: { readonly setId: Id<"exerciseSets"> }) {
  const ctx = yield* MutationCtx;
  const now = yield* Clock.currentTimeMillis;
  const set = yield* Effect.promise(() => ctx.db.get(args.setId));

  if (!set) {
    return null;
  }

  const cacheStats = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationCacheStats")
      .withIndex("by_setId", (query) => query.eq("setId", args.setId))
      .unique()
  );

  if (!cacheStats) {
    yield* scheduleCalibrationCacheStatsRebuild(ctx, args.setId);
    return null;
  }

  const cacheLimit = getCalibrationAttemptCacheLimit(set.questionCount);
  const oldestAttempts = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId", (query) => query.eq("setId", args.setId))
      .take(IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE)
  );

  if (oldestAttempts.length === 0) {
    yield* Effect.promise(() => ctx.db.delete(cacheStats._id));
    return null;
  }

  const windowStartAt = getCalibrationWindowStartAt(now);
  const staleAttempts = oldestAttempts.filter(
    (attempt) => attempt._creationTime < windowStartAt
  );
  let attemptsToDelete = staleAttempts;

  if (attemptsToDelete.length === 0 && cacheStats.attemptCount <= cacheLimit) {
    return null;
  }

  if (attemptsToDelete.length === 0) {
    const trimCount = Math.min(
      cacheStats.attemptCount - cacheLimit,
      IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE
    );
    attemptsToDelete = oldestAttempts.slice(0, trimCount);
  }

  for (const calibrationAttempt of attemptsToDelete) {
    yield* Effect.promise(() => ctx.db.delete(calibrationAttempt._id));
  }

  const nextAttemptCount = Math.max(
    0,
    cacheStats.attemptCount - attemptsToDelete.length
  );

  if (nextAttemptCount === 0) {
    yield* Effect.promise(() => ctx.db.delete(cacheStats._id));
    return null;
  }

  yield* Effect.promise(() =>
    ctx.db.patch(cacheStats._id, {
      attemptCount: nextAttemptCount,
      updatedAt: now,
    })
  );

  if (
    attemptsToDelete.length === IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE ||
    nextAttemptCount > cacheLimit
  ) {
    yield* scheduleCalibrationCacheTrim(ctx, args.setId);
  }

  return null;
});
