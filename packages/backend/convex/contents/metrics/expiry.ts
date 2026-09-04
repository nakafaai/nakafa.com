import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  ExpireLearningPopularityWindowPageArgs,
  ExpireLearningPopularityWindowPageResult,
  RefreshLearningPopularityWindowPageArgs,
  RefreshLearningPopularityWindowPageResult,
} from "@repo/backend/convex/contents/analytics/spec";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import { LEARNING_POPULARITY_REFRESH_BATCH_SIZE } from "@repo/backend/convex/contents/constants";
import {
  advancePopularityCycle,
  beginPopularityCycle,
  completePopularityCycle,
  getPopularityCyclePage,
} from "@repo/backend/convex/contents/metrics/cycle";
import { repairPopularityCounter } from "@repo/backend/convex/contents/metrics/repair";
import {
  type RetentionPageReference,
  startLearningPopularityRetention,
} from "@repo/backend/convex/contents/metrics/retention";
import { getAppliedCount } from "@repo/backend/convex/contents/metrics/signal";
import {
  getFinitePopularityWindows,
  getPopularitySignalDay,
  getPopularityWindowStartDay,
  type LearningPopularityFiniteWindow,
  learningPopularityScopeValues,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

type PopularityCounter = Doc<"learningPopularityCounters">;

type ExpirePageReference = FunctionReference<
  "mutation",
  "internal",
  ExpireLearningPopularityWindowPageArgs,
  ExpireLearningPopularityWindowPageResult
>;

type RepairPageReference = FunctionReference<
  "mutation",
  "internal",
  RefreshLearningPopularityWindowPageArgs,
  RefreshLearningPopularityWindowPageResult
>;

/** Loads the one daily signal leaving a finite popularity window. */
const loadExpiringSignal = Effect.fn("contents.metrics.loadExpiringSignal")(
  function* (
    ctx: MutationCtx,
    counter: PopularityCounter,
    windowKey: LearningPopularityFiniteWindow,
    day: number
  ) {
    const signalDay =
      getPopularityWindowStartDay(windowKey, day) - POPULARITY_DAY_MS;

    return yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("learningPopularitySignals")
          .withIndex(
            "by_scopeMode_and_content_id_and_contextKey_and_signalDay",
            (q) =>
              q
                .eq("scopeMode", counter.scopeMode)
                .eq("content_id", counter.content_id)
                .eq("contextKey", counter.contextKey)
                .eq("signalDay", signalDay)
          )
          .unique(),
      catch: toContentAnalyticsIoError,
    });
  }
);

/** Subtracts the exact outgoing contribution or repairs detected drift. */
const expirePopularityCounter = Effect.fn(
  "contents.metrics.expirePopularityCounter"
)(function* (
  ctx: MutationCtx,
  counter: PopularityCounter,
  windowKey: LearningPopularityFiniteWindow,
  day: number,
  updatedAt: number
) {
  const signal = yield* loadExpiringSignal(ctx, counter, windowKey, day);
  const expiredCount = signal ? getAppliedCount(signal.applied, windowKey) : 0;
  const score = counter.score - expiredCount;

  if (expiredCount < 0 || score < 0) {
    const repair = yield* repairPopularityCounter(
      ctx,
      counter,
      windowKey,
      day,
      updatedAt
    );
    return {
      expired: false,
      removed: repair.removed,
      repaired: true,
    };
  }

  if (expiredCount === 0) {
    return {
      expired: false,
      removed: false,
      repaired: false,
    };
  }

  if (score === 0) {
    yield* Effect.tryPromise({
      try: () => ctx.db.delete(counter._id),
      catch: toContentAnalyticsIoError,
    });
    return {
      expired: true,
      removed: true,
      repaired: false,
    };
  }

  yield* Effect.tryPromise({
    try: () => ctx.db.patch(counter._id, { score, updatedAt }),
    catch: toContentAnalyticsIoError,
  });

  return {
    expired: true,
    removed: false,
    repaired: false,
  };
});

/** Claims and schedules one daily maintenance job per finite namespace. */
export const scheduleLearningPopularityExpiries = Effect.fn(
  "contents.metrics.scheduleLearningPopularityExpiries"
)(function* (
  ctx: MutationCtx,
  expirePage: ExpirePageReference,
  repairPage: RepairPageReference
) {
  const timestamp = yield* Clock.currentTimeMillis;
  const day = getPopularitySignalDay(timestamp);
  let expiryWindows = 0;
  let repairWindows = 0;
  let skippedWindows = 0;

  for (const scopeMode of learningPopularityScopeValues) {
    for (const windowKey of getFinitePopularityWindows()) {
      const cycle = yield* beginPopularityCycle(ctx, {
        day,
        forceRepair: false,
        scopeMode,
        windowKey,
      });

      if (cycle.mode === "skipped") {
        skippedWindows += 1;
        continue;
      }

      const reference = cycle.mode === "expiry" ? expirePage : repairPage;
      yield* Effect.tryPromise({
        try: () =>
          ctx.scheduler.runAfter(0, reference, {
            ...(cycle.cursor === undefined ? {} : { cursor: cycle.cursor }),
            day,
            scopeMode,
            windowKey,
          }),
        catch: toContentAnalyticsIoError,
      });

      if (cycle.mode === "expiry") {
        expiryWindows += 1;
      } else {
        repairWindows += 1;
      }
    }
  }

  return {
    expiryWindows,
    repairWindows,
    skippedWindows,
  };
});

/** Expires one bounded counter page using one indexed signal read per row. */
export const expireLearningPopularityWindowPage = Effect.fn(
  "contents.metrics.expireLearningPopularityWindowPage"
)(function* (
  ctx: MutationCtx,
  args: ExpireLearningPopularityWindowPageArgs,
  expirePage: ExpirePageReference,
  retentionPage: RetentionPageReference
) {
  const cycle = yield* getPopularityCyclePage(ctx, {
    cursor: args.cursor,
    day: args.day,
    mode: "expiry",
    scopeMode: args.scopeMode,
    windowKey: args.windowKey,
  });
  if (!cycle.current) {
    return {
      continueCursor: cycle.continueCursor,
      expiredCounters: 0,
      isDone: true,
      removedCounters: 0,
      repairedCounters: 0,
      skipped: true,
    };
  }

  const updatedAt = yield* Clock.currentTimeMillis;
  const page = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularityCounters")
        .withIndex(
          "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
          (q) =>
            q.eq("windowKey", args.windowKey).eq("scopeMode", args.scopeMode)
        )
        .paginate({
          cursor: args.cursor ?? null,
          numItems: LEARNING_POPULARITY_REFRESH_BATCH_SIZE,
        }),
    catch: toContentAnalyticsIoError,
  });

  let expiredCounters = 0;
  let removedCounters = 0;
  let repairedCounters = 0;

  for (const counter of page.page) {
    const result = yield* expirePopularityCounter(
      ctx,
      counter,
      args.windowKey,
      args.day,
      updatedAt
    );

    if (result.expired) {
      expiredCounters += 1;
    }

    if (result.removed) {
      removedCounters += 1;
    }

    if (result.repaired) {
      repairedCounters += 1;
    }
  }

  if (page.isDone) {
    yield* completePopularityCycle(ctx, cycle.cycleId, args.day);
    yield* startLearningPopularityRetention(ctx, args.day, retentionPage);
  } else {
    yield* advancePopularityCycle(ctx, cycle.cycleId, page.continueCursor);
    yield* Effect.tryPromise({
      try: () =>
        ctx.scheduler.runAfter(0, expirePage, {
          cursor: page.continueCursor,
          day: args.day,
          scopeMode: args.scopeMode,
          windowKey: args.windowKey,
        }),
      catch: toContentAnalyticsIoError,
    });
  }

  return {
    continueCursor: page.continueCursor,
    expiredCounters,
    isDone: page.isDone,
    removedCounters,
    repairedCounters,
    skipped: false,
  };
});
