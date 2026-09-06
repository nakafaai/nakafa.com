import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  SweepLearningPopularityRetentionArgs,
  SweepLearningPopularityRetentionResult,
} from "@repo/backend/convex/contents/analytics/spec";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import { POPULARITY_RETENTION_BATCH_SIZE } from "@repo/backend/convex/contents/constants";
import {
  getFinitePopularityWindows,
  getPopularityWindowStartDay,
  learningPopularityScopeValues,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import type { FunctionReference } from "convex/server";
import { Effect } from "effect";

export type RetentionPageReference = FunctionReference<
  "mutation",
  "internal",
  SweepLearningPopularityRetentionArgs,
  SweepLearningPopularityRetentionResult
>;

/** Reads the singleton that owns the active popularity retention chain. */
const loadRetention = Effect.fn("contents.metrics.loadRetention")(function* (
  ctx: MutationCtx
) {
  return yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularityRetention")
        .withIndex("by_key", (query) => query.eq("key", "popularity"))
        .unique(),
    catch: toContentAnalyticsIoError,
  });
});

/** Schedules the next bounded retention page for the claimed UTC day. */
const scheduleRetentionPage = Effect.fn(
  "contents.metrics.scheduleRetentionPage"
)(function* (
  ctx: MutationCtx,
  day: number,
  retentionPage: RetentionPageReference
) {
  yield* Effect.tryPromise({
    try: () => ctx.scheduler.runAfter(0, retentionPage, { day }),
    catch: toContentAnalyticsIoError,
  });
});

/** Returns whether all finite namespaces completed maintenance for one day. */
const hasCompletedPopularityMaintenance = Effect.fn(
  "contents.metrics.hasCompletedPopularityMaintenance"
)(function* (ctx: MutationCtx, day: number) {
  for (const scopeMode of learningPopularityScopeValues) {
    for (const windowKey of getFinitePopularityWindows()) {
      const cycle = yield* Effect.tryPromise({
        try: () =>
          ctx.db
            .query("learningPopularityCycles")
            .withIndex("by_scopeMode_and_windowKey", (query) =>
              query.eq("scopeMode", scopeMode).eq("windowKey", windowKey)
            )
            .unique(),
        catch: toContentAnalyticsIoError,
      });

      if (cycle?.completedDay !== day) {
        return false;
      }
    }
  }

  return true;
});

/** Claims one retention chain after every daily repair or expiry cycle finishes. */
export const startLearningPopularityRetention = Effect.fn(
  "contents.metrics.startLearningPopularityRetention"
)(function* (
  ctx: MutationCtx,
  day: number,
  retentionPage: RetentionPageReference
) {
  if (!(yield* hasCompletedPopularityMaintenance(ctx, day))) {
    return false;
  }

  const retention = yield* loadRetention(ctx);
  if (retention && retention.day >= day) {
    return false;
  }

  if (retention) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(retention._id, {
          completedDay: undefined,
          day,
          phase: "viewers",
        }),
      catch: toContentAnalyticsIoError,
    });
  } else {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("learningPopularityRetention", {
          day,
          key: "popularity",
          phase: "viewers",
        }),
      catch: toContentAnalyticsIoError,
    });
  }

  yield* scheduleRetentionPage(ctx, day, retentionPage);
  return true;
});

/** Deletes one indexed page whose popularity repair value has expired. */
export const sweepLearningPopularityRetention = Effect.fn(
  "contents.metrics.sweepLearningPopularityRetention"
)(function* (
  ctx: MutationCtx,
  args: SweepLearningPopularityRetentionArgs,
  retentionPage: RetentionPageReference
) {
  const retention = yield* loadRetention(ctx);
  if (
    !retention ||
    retention.day !== args.day ||
    retention.completedDay === args.day
  ) {
    return {
      deleted: 0,
      done: true,
      skipped: true,
    };
  }

  if (retention.phase === "viewers") {
    const signals = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("learningPopularityViewerSignals")
          .withIndex("by_signalDay", (query) => query.lt("signalDay", args.day))
          .take(POPULARITY_RETENTION_BATCH_SIZE),
      catch: toContentAnalyticsIoError,
    });

    for (const signal of signals) {
      yield* Effect.tryPromise({
        try: () => ctx.db.delete(signal._id),
        catch: toContentAnalyticsIoError,
      });
    }

    if (signals.length === POPULARITY_RETENTION_BATCH_SIZE) {
      yield* scheduleRetentionPage(ctx, args.day, retentionPage);
      return {
        deleted: signals.length,
        done: false,
        skipped: false,
      };
    }

    yield* Effect.tryPromise({
      try: () => ctx.db.patch(retention._id, { phase: "signals" }),
      catch: toContentAnalyticsIoError,
    });
    yield* scheduleRetentionPage(ctx, args.day, retentionPage);

    return {
      deleted: signals.length,
      done: false,
      skipped: false,
    };
  }

  const expiredSignalDay =
    getPopularityWindowStartDay("365d", args.day) - POPULARITY_DAY_MS;
  const signals = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularitySignals")
        .withIndex("by_signalDay", (query) =>
          query.lte("signalDay", expiredSignalDay)
        )
        .take(POPULARITY_RETENTION_BATCH_SIZE),
    catch: toContentAnalyticsIoError,
  });

  for (const signal of signals) {
    yield* Effect.tryPromise({
      try: () => ctx.db.delete(signal._id),
      catch: toContentAnalyticsIoError,
    });
  }

  if (signals.length === POPULARITY_RETENTION_BATCH_SIZE) {
    yield* scheduleRetentionPage(ctx, args.day, retentionPage);
    return {
      deleted: signals.length,
      done: false,
      skipped: false,
    };
  }

  yield* Effect.tryPromise({
    try: () => ctx.db.patch(retention._id, { completedDay: args.day }),
    catch: toContentAnalyticsIoError,
  });

  return {
    deleted: signals.length,
    done: true,
    skipped: false,
  };
});
