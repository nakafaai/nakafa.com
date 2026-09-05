import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
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
import {
  getFinitePopularityWindows,
  getPopularitySignalDay,
  learningPopularityScopeValues,
} from "@repo/backend/convex/contents/popularity";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

/** Generated internal mutation reference accepted by Convex refresh scheduling. */
type RefreshLearningPopularityWindowPageReference = FunctionReference<
  "mutation",
  "internal",
  RefreshLearningPopularityWindowPageArgs,
  RefreshLearningPopularityWindowPageResult
>;

/** Schedules bounded repair work for every finite popularity namespace. */
export const scheduleLearningPopularityRefreshes = Effect.fn(
  "contents.metrics.scheduleLearningPopularityRefreshes"
)(function* (
  ctx: MutationCtx,
  refreshWindowPage: RefreshLearningPopularityWindowPageReference
) {
  const timestamp = yield* Clock.currentTimeMillis;
  const day = getPopularitySignalDay(timestamp);
  let scheduledWindows = 0;

  for (const scopeMode of learningPopularityScopeValues) {
    for (const windowKey of getFinitePopularityWindows()) {
      const cycle = yield* beginPopularityCycle(ctx, {
        day,
        forceRepair: true,
        scopeMode,
        windowKey,
      });

      if (cycle.mode === "skipped") {
        continue;
      }

      yield* Effect.tryPromise({
        try: () =>
          ctx.scheduler.runAfter(0, refreshWindowPage, {
            ...(cycle.cursor === undefined ? {} : { cursor: cycle.cursor }),
            day,
            scopeMode,
            windowKey,
          }),
        catch: toContentAnalyticsIoError,
      });

      scheduledWindows += 1;
    }
  }

  return {
    scheduledWindows,
  };
});

/** Repairs finite counters from their durable lifetime identity registry. */
export const refreshLearningPopularityWindowPage = Effect.fn(
  "contents.metrics.refreshLearningPopularityWindowPage"
)(function* (
  ctx: MutationCtx,
  args: RefreshLearningPopularityWindowPageArgs,
  refreshWindowPage: RefreshLearningPopularityWindowPageReference,
  retentionPage: RetentionPageReference
) {
  const timestamp = yield* Clock.currentTimeMillis;
  const cycle = yield* getPopularityCyclePage(ctx, {
    cursor: args.cursor,
    day: args.day,
    mode: "repair",
    scopeMode: args.scopeMode,
    windowKey: args.windowKey,
  });

  if (!cycle.current) {
    return {
      continueCursor: cycle.continueCursor,
      isDone: true,
      refreshedCounters: 0,
      removedCounters: 0,
      skipped: true,
    };
  }

  const page = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularityCounters")
        .withIndex(
          "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
          (q) => q.eq("windowKey", "lifetime").eq("scopeMode", args.scopeMode)
        )
        .paginate({
          cursor: args.cursor ?? null,
          numItems: LEARNING_POPULARITY_REFRESH_BATCH_SIZE,
        }),
    catch: toContentAnalyticsIoError,
  });

  let refreshedCounters = 0;
  let removedCounters = 0;

  for (const counter of page.page) {
    const result = yield* repairPopularityCounter(
      ctx,
      counter,
      args.windowKey,
      args.day,
      timestamp
    );

    if (result.refreshed) {
      refreshedCounters += 1;
    }

    if (result.removed) {
      removedCounters += 1;
    }
  }

  if (!page.isDone) {
    yield* advancePopularityCycle(ctx, cycle.cycleId, page.continueCursor);
    yield* Effect.tryPromise({
      try: () =>
        ctx.scheduler.runAfter(0, refreshWindowPage, {
          cursor: page.continueCursor,
          day: args.day,
          scopeMode: args.scopeMode,
          windowKey: args.windowKey,
        }),
      catch: toContentAnalyticsIoError,
    });
  }

  if (page.isDone) {
    yield* completePopularityCycle(ctx, cycle.cycleId, args.day);
    yield* startLearningPopularityRetention(ctx, args.day, retentionPage);
  }

  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    refreshedCounters,
    removedCounters,
    skipped: false,
  };
});
