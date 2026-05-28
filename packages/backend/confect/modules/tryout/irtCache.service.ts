import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import {
  getCalibrationAttemptCacheLimit,
  getCalibrationWindowStartAt,
  IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
  IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import { Clock, Duration, Effect, Option } from "effect";

/** Schedules a calibration cache stats rebuild for one exercise set. */
export function scheduleCalibrationCacheStatsRebuild(
  setId: Id<"exerciseSets">
) {
  return Effect.gen(function* () {
    const scheduler = yield* Scheduler;

    return yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.irt.mutations.internalFunctions.cache
        .rebuildCalibrationCacheStatsForSet,
      { setId }
    );
  });
}

/** Schedules calibration cache trimming for one exercise set. */
export function scheduleCalibrationCacheTrim(setId: Id<"exerciseSets">) {
  return Effect.gen(function* () {
    const scheduler = yield* Scheduler;

    return yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.irt.mutations.internalFunctions.cache
        .trimCalibrationCacheForSet,
      { setId }
    );
  });
}

/** Reschedules calibration cache stats rebuilding with accumulated progress. */
function scheduleCalibrationCacheStatsRebuildPage(args: {
  readonly cursor: string;
  readonly progress: { readonly attemptCount: number };
  readonly setId: Id<"exerciseSets">;
}) {
  return Effect.gen(function* () {
    const scheduler = yield* Scheduler;

    return yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.irt.mutations.internalFunctions.cache
        .rebuildCalibrationCacheStatsForSet,
      args
    );
  });
}

/** Ensures a set's calibration cache is within bounded processing limits. */
export const prepareCalibrationCacheForSet = Effect.fn(
  "irt.cache.prepareCalibrationCacheForSet"
)(function* (setId: Id<"exerciseSets">) {
  const reader = yield* DatabaseReader;
  const now = yield* Clock.currentTimeMillis;
  const set = yield* reader
    .table("exerciseSets")
    .get(setId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!set) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_SET_NOT_FOUND",
        message: "Exercise set not found for calibration cache management.",
      })
    );
  }

  const cacheStats = yield* reader
    .table("irtCalibrationCacheStats")
    .get("by_setId", setId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (!cacheStats) {
    yield* scheduleCalibrationCacheStatsRebuild(setId);
    return false;
  }

  if (
    cacheStats.attemptCount <=
    getCalibrationAttemptCacheLimit(set.questionCount)
  ) {
    const oldestCachedAttempt = yield* reader
      .table("irtCalibrationAttempts")
      .index("by_setId", (query) => query.eq("setId", setId))
      .first()
      .pipe(Effect.map(Option.getOrNull));

    if (
      !oldestCachedAttempt ||
      oldestCachedAttempt._creationTime >= getCalibrationWindowStartAt(now)
    ) {
      return true;
    }
  }

  yield* scheduleCalibrationCacheTrim(setId);
  return false;
});

/** Adjusts cached attempt stats after cache row insertion or deletion. */
export const adjustCalibrationCacheAttemptCount = Effect.fn(
  "irt.cache.adjustCalibrationCacheAttemptCount"
)(function* (args: {
  readonly delta: number;
  readonly setId: Id<"exerciseSets">;
  readonly updatedAt: number;
}) {
  if (args.delta === 0) {
    return false;
  }

  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const cacheStats = yield* reader
    .table("irtCalibrationCacheStats")
    .get("by_setId", args.setId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (!cacheStats) {
    return false;
  }

  const nextAttemptCount = Math.max(0, cacheStats.attemptCount + args.delta);

  if (nextAttemptCount === 0) {
    yield* writer.table("irtCalibrationCacheStats").delete(cacheStats._id);
    return true;
  }

  yield* writer.table("irtCalibrationCacheStats").patch(cacheStats._id, {
    attemptCount: nextAttemptCount,
    updatedAt: args.updatedAt,
  });

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
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const set = yield* reader
    .table("exerciseSets")
    .get(args.setId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!set) {
    return null;
  }

  const page = yield* reader
    .table("irtCalibrationAttempts")
    .index("by_setId", (query) => query.eq("setId", args.setId))
    .paginate({
      cursor: args.cursor ?? null,
      numItems: IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
    });
  const progress = {
    attemptCount: (args.progress?.attemptCount ?? 0) + page.page.length,
  };

  if (!page.isDone) {
    yield* scheduleCalibrationCacheStatsRebuildPage({
      cursor: page.continueCursor,
      progress,
      setId: args.setId,
    });
    return null;
  }

  const cacheStats = yield* reader
    .table("irtCalibrationCacheStats")
    .get("by_setId", args.setId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (progress.attemptCount === 0) {
    if (cacheStats) {
      yield* writer.table("irtCalibrationCacheStats").delete(cacheStats._id);
    }

    return null;
  }

  const now = yield* Clock.currentTimeMillis;

  if (cacheStats) {
    yield* writer.table("irtCalibrationCacheStats").patch(cacheStats._id, {
      attemptCount: progress.attemptCount,
      updatedAt: now,
    });
  } else {
    yield* writer.table("irtCalibrationCacheStats").insert({
      attemptCount: progress.attemptCount,
      setId: args.setId,
      updatedAt: now,
    });
  }

  if (
    progress.attemptCount <= getCalibrationAttemptCacheLimit(set.questionCount)
  ) {
    return null;
  }

  yield* scheduleCalibrationCacheTrim(args.setId);
  return null;
});

/** Trims stale or overflow calibration cache rows for one set. */
export const trimCalibrationCacheForSet = Effect.fn(
  "irt.cache.trimCalibrationCacheForSet"
)(function* (args: { readonly setId: Id<"exerciseSets"> }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const now = yield* Clock.currentTimeMillis;
  const set = yield* reader
    .table("exerciseSets")
    .get(args.setId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!set) {
    return null;
  }

  const cacheStats = yield* reader
    .table("irtCalibrationCacheStats")
    .get("by_setId", args.setId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (!cacheStats) {
    yield* scheduleCalibrationCacheStatsRebuild(args.setId);
    return null;
  }

  const cacheLimit = getCalibrationAttemptCacheLimit(set.questionCount);
  const oldestAttempts = yield* reader
    .table("irtCalibrationAttempts")
    .index("by_setId", (query) => query.eq("setId", args.setId))
    .take(IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE);

  if (oldestAttempts.length === 0) {
    yield* writer.table("irtCalibrationCacheStats").delete(cacheStats._id);
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
    yield* writer
      .table("irtCalibrationAttempts")
      .delete(calibrationAttempt._id);
  }

  const nextAttemptCount = Math.max(
    0,
    cacheStats.attemptCount - attemptsToDelete.length
  );

  if (nextAttemptCount === 0) {
    yield* writer.table("irtCalibrationCacheStats").delete(cacheStats._id);
    return null;
  }

  yield* writer.table("irtCalibrationCacheStats").patch(cacheStats._id, {
    attemptCount: nextAttemptCount,
    updatedAt: now,
  });

  if (
    attemptsToDelete.length === IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE ||
    nextAttemptCount > cacheLimit
  ) {
    yield* scheduleCalibrationCacheTrim(args.setId);
  }

  return null;
});
