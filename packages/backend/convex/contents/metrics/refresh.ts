import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  RefreshLearningPopularityWindowPageArgs,
  RefreshLearningPopularityWindowPageResult,
} from "@repo/backend/convex/contents/analytics/spec";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import { LEARNING_POPULARITY_REFRESH_BATCH_SIZE } from "@repo/backend/convex/contents/constants";
import {
  getFinitePopularityWindows,
  getPopularitySignalDay,
  getPopularityWindowStartDay,
  isFinitePopularityWindow,
  learningPopularityScopeValues,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

type PopularityCounter = Doc<"learningPopularityCounters">;
type PopularitySignal = Doc<"learningPopularitySignals">;

/** Internal mutation references needed for bounded refresh scheduling. */
export interface LearningPopularityRefreshTargets {
  readonly refreshWindowPage: FunctionReference<
    "mutation",
    "internal",
    RefreshLearningPopularityWindowPageArgs,
    RefreshLearningPopularityWindowPageResult
  >;
}

/** Loads one daily signal row for a popularity counter and signal day. */
const loadPopularitySignal = Effect.fn("contents.metrics.loadPopularitySignal")(
  function* (ctx: MutationCtx, counter: PopularityCounter, signalDay: number) {
    return yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("learningPopularitySignals")
          .withIndex(
            "by_scopeMode_and_signalDay_and_content_id_and_contextKey",
            (q) =>
              q
                .eq("scopeMode", counter.scopeMode)
                .eq("signalDay", signalDay)
                .eq("content_id", counter.content_id)
                .eq("contextKey", counter.contextKey)
          )
          .unique(),
      catch: toContentAnalyticsIoError,
    });
  }
);

/** Recomputes one finite-window counter from durable daily signal rows. */
const recomputePopularityCounter = Effect.fn(
  "contents.metrics.recomputePopularityCounter"
)(function* (ctx: MutationCtx, counter: PopularityCounter, timestamp: number) {
  if (!isFinitePopularityWindow(counter.windowKey)) {
    return {
      latestSignal: null,
      score: counter.score,
    };
  }

  const currentDay = getPopularitySignalDay(timestamp);
  const startDay = getPopularityWindowStartDay(counter.windowKey, timestamp);
  let latestSignal: PopularitySignal | null = null;
  let score = 0;

  for (
    let signalDay = startDay;
    signalDay <= currentDay;
    signalDay += POPULARITY_DAY_MS
  ) {
    const signal = yield* loadPopularitySignal(ctx, counter, signalDay);

    if (!signal) {
      continue;
    }

    score += signal.viewCount;
    latestSignal = signal;
  }

  return {
    latestSignal,
    score,
  };
});

/** Applies a recomputed finite-window score to one popularity counter row. */
const refreshPopularityCounter = Effect.fn(
  "contents.metrics.refreshPopularityCounter"
)(function* (ctx: MutationCtx, counter: PopularityCounter, timestamp: number) {
  const refresh = yield* recomputePopularityCounter(ctx, counter, timestamp);

  if (refresh.score <= 0) {
    yield* Effect.tryPromise({
      try: () => ctx.db.delete(counter._id),
      catch: toContentAnalyticsIoError,
    });

    return {
      removed: true,
      refreshed: false,
    };
  }

  const latestSignal = refresh.latestSignal;

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch(counter._id, {
        alignmentId: latestSignal?.alignmentId ?? counter.alignmentId,
        assetId: latestSignal?.assetId ?? counter.assetId,
        conceptId: latestSignal?.conceptId ?? counter.conceptId,
        contextMaterialKey:
          latestSignal?.contextMaterialKey ?? counter.contextMaterialKey,
        contextMode: latestSignal?.contextMode ?? counter.contextMode,
        contextNodeKey: latestSignal?.contextNodeKey ?? counter.contextNodeKey,
        contextParentPath:
          latestSignal?.contextParentPath ?? counter.contextParentPath,
        contextProgramKey:
          latestSignal?.contextProgramKey ?? counter.contextProgramKey,
        contextPublicPath:
          latestSignal?.contextPublicPath ?? counter.contextPublicPath,
        contextSourcePath:
          latestSignal?.contextSourcePath ?? counter.contextSourcePath,
        description: latestSignal?.description ?? counter.description,
        learningObjectId:
          latestSignal?.learningObjectId ?? counter.learningObjectId,
        lensId: latestSignal?.lensId ?? counter.lensId,
        materialDomain: latestSignal?.materialDomain ?? counter.materialDomain,
        route: latestSignal?.route ?? counter.route,
        score: refresh.score,
        sourcePath: latestSignal?.sourcePath ?? counter.sourcePath,
        title: latestSignal?.title ?? counter.title,
        updatedAt: timestamp,
      }),
    catch: toContentAnalyticsIoError,
  });

  return {
    removed: false,
    refreshed: true,
  };
});

/** Schedules bounded refresh work for every finite popularity window and scope. */
export const scheduleLearningPopularityRefreshes = Effect.fn(
  "contents.metrics.scheduleLearningPopularityRefreshes"
)(function* (ctx: MutationCtx, targets: LearningPopularityRefreshTargets) {
  let scheduledWindows = 0;

  for (const scopeMode of learningPopularityScopeValues) {
    for (const windowKey of getFinitePopularityWindows()) {
      yield* Effect.tryPromise({
        try: () =>
          ctx.scheduler.runAfter(0, targets.refreshWindowPage, {
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

/** Refreshes one bounded page of finite-window popularity counters. */
export const refreshLearningPopularityWindowPage = Effect.fn(
  "contents.metrics.refreshLearningPopularityWindowPage"
)(function* (
  ctx: MutationCtx,
  args: RefreshLearningPopularityWindowPageArgs,
  targets: LearningPopularityRefreshTargets
) {
  if (!isFinitePopularityWindow(args.windowKey)) {
    return {
      continueCursor: args.cursor ?? "",
      isDone: true,
      refreshedCounters: 0,
      removedCounters: 0,
      skipped: true,
    };
  }

  const timestamp = yield* Clock.currentTimeMillis;
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

  let refreshedCounters = 0;
  let removedCounters = 0;

  for (const counter of page.page) {
    const result = yield* refreshPopularityCounter(ctx, counter, timestamp);

    if (result.refreshed) {
      refreshedCounters += 1;
    }

    if (result.removed) {
      removedCounters += 1;
    }
  }

  if (!page.isDone) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.scheduler.runAfter(0, targets.refreshWindowPage, {
          cursor: page.continueCursor,
          scopeMode: args.scopeMode,
          windowKey: args.windowKey,
        }),
      catch: toContentAnalyticsIoError,
    });
  }

  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    refreshedCounters,
    removedCounters,
    skipped: false,
  };
});
