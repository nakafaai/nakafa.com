import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import {
  getPopularitySignalDay,
  getPopularityWindowDayCount,
  getPopularityWindowStartDay,
  type LearningPopularityFiniteWindow,
} from "@repo/backend/convex/contents/popularity";
import { Effect } from "effect";

type PopularityCounter = Doc<"learningPopularityCounters">;
type PopularitySignal = Doc<"learningPopularitySignals">;

/** Rebuilt semantics; `updatedAt` advances only when one of these changes. */
const refreshFields = [
  "alignmentId",
  "assetId",
  "conceptId",
  "contextMaterialKey",
  "contextMode",
  "contextNodeKey",
  "contextParentPath",
  "contextProgramKey",
  "contextPublicPath",
  "contextSourcePath",
  "description",
  "latestDay",
  "learningObjectId",
  "lensId",
  "materialDomain",
  "route",
  "score",
  "sourcePath",
  "title",
] as const satisfies readonly (keyof PopularityCounter)[];

type Refresh = Pick<PopularityCounter, (typeof refreshFields)[number]>;

/** Loads bounded daily signal rows for one counter and finite window. */
const loadPopularitySignals = Effect.fn(
  "contents.metrics.loadPopularitySignals"
)(function* (
  ctx: MutationCtx,
  counter: PopularityCounter,
  windowKey: LearningPopularityFiniteWindow,
  timestamp: number
) {
  const currentDay = getPopularitySignalDay(timestamp);
  const startDay = getPopularityWindowStartDay(windowKey, timestamp);
  const dayCount = getPopularityWindowDayCount(windowKey);

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
              .gte("signalDay", startDay)
              .lte("signalDay", currentDay)
        )
        .take(dayCount),
    catch: toContentAnalyticsIoError,
  });
});

/** Recomputes one finite-window counter from durable daily signal rows. */
const recomputePopularityCounter = Effect.fn(
  "contents.metrics.recomputePopularityCounter"
)(function* (
  ctx: MutationCtx,
  counter: PopularityCounter,
  windowKey: LearningPopularityFiniteWindow,
  timestamp: number
) {
  const signals = yield* loadPopularitySignals(
    ctx,
    counter,
    windowKey,
    timestamp
  );
  let latestSignal: PopularitySignal | null = null;
  let score = 0;

  for (const signal of signals) {
    score += signal.viewCount;
    latestSignal = signal;
  }

  return {
    latestSignal,
    score,
  };
});

/** Projects the stored counter state produced by one authoritative rebuild. */
function projectPopularityRefresh(
  counter: PopularityCounter,
  latestSignal: PopularitySignal,
  score: number
): Refresh {
  return {
    alignmentId: latestSignal.alignmentId,
    assetId: latestSignal.assetId,
    conceptId: latestSignal.conceptId,
    contextMaterialKey:
      latestSignal.contextMaterialKey ?? counter.contextMaterialKey,
    contextMode: latestSignal.contextMode,
    contextNodeKey: latestSignal.contextNodeKey ?? counter.contextNodeKey,
    contextParentPath:
      latestSignal.contextParentPath ?? counter.contextParentPath,
    contextProgramKey:
      latestSignal.contextProgramKey ?? counter.contextProgramKey,
    contextPublicPath:
      latestSignal.contextPublicPath ?? counter.contextPublicPath,
    contextSourcePath:
      latestSignal.contextSourcePath ?? counter.contextSourcePath,
    description: latestSignal.description ?? counter.description,
    latestDay: latestSignal.signalDay,
    learningObjectId: latestSignal.learningObjectId,
    lensId: latestSignal.lensId,
    materialDomain: latestSignal.materialDomain ?? counter.materialDomain,
    route: latestSignal.route,
    score,
    sourcePath: latestSignal.sourcePath,
    title: latestSignal.title,
  };
}

/** Rebuilds one finite counter from its bounded authoritative signal rows. */
export const repairPopularityCounter = Effect.fn(
  "contents.metrics.repairPopularityCounter"
)(function* (
  ctx: MutationCtx,
  counter: PopularityCounter,
  windowKey: LearningPopularityFiniteWindow,
  day: number,
  updatedAt: number
) {
  const refresh = yield* recomputePopularityCounter(
    ctx,
    counter,
    windowKey,
    day
  );

  if (refresh.latestSignal === null || refresh.score <= 0) {
    yield* Effect.tryPromise({
      try: () => ctx.db.delete(counter._id),
      catch: toContentAnalyticsIoError,
    });

    return {
      removed: true,
      refreshed: false,
    };
  }

  const update = projectPopularityRefresh(
    counter,
    refresh.latestSignal,
    refresh.score
  );
  const changed = refreshFields.some(
    (field) => counter[field] !== update[field]
  );

  if (!changed) {
    return {
      removed: false,
      refreshed: false,
    };
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch(counter._id, {
        ...update,
        updatedAt,
      }),
    catch: toContentAnalyticsIoError,
  });

  return {
    removed: false,
    refreshed: true,
  };
});
