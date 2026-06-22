import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import {
  buildMetricsBatch,
  type PopularityCounterDelta,
  type PopularitySignalDelta,
} from "@repo/backend/convex/contents/metrics/batch";
import { Effect } from "effect";

/** Applies one verified daily popularity signal delta. */
const applySignal = Effect.fn("contents.metrics.applySignal")(function* (
  ctx: MutationCtx,
  delta: PopularitySignalDelta & { readonly updatedAt: number }
) {
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularitySignals")
        .withIndex(
          "by_scopeMode_and_signalDay_and_content_id_and_contextKey",
          (q) =>
            q
              .eq("scopeMode", delta.scopeMode)
              .eq("signalDay", delta.signalDay)
              .eq("content_id", delta.ref.content_id)
              .eq("contextKey", delta.context.contextKey)
        )
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("learningPopularitySignals", {
          ...delta.ref,
          ...delta.context,
          description: delta.description,
          locale: delta.locale,
          materialDomain: delta.materialDomain,
          route: delta.route,
          section: delta.section,
          scopeMode: delta.scopeMode,
          signalDay: delta.signalDay,
          sourcePath: delta.sourcePath,
          title: delta.title,
          updatedAt: delta.updatedAt,
          viewCount: delta.viewCount,
        }),
      catch: toContentAnalyticsIoError,
    });
    return;
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("learningPopularitySignals", currentRow._id, {
        ...delta.ref,
        ...delta.context,
        description: delta.description,
        locale: delta.locale,
        materialDomain: delta.materialDomain,
        route: delta.route,
        section: delta.section,
        scopeMode: delta.scopeMode,
        signalDay: delta.signalDay,
        sourcePath: delta.sourcePath,
        title: delta.title,
        updatedAt: delta.updatedAt,
        viewCount: currentRow.viewCount + delta.viewCount,
      }),
    catch: toContentAnalyticsIoError,
  });
});

/** Applies one ranked popularity counter delta. */
const applyCounter = Effect.fn("contents.metrics.applyCounter")(function* (
  ctx: MutationCtx,
  delta: PopularityCounterDelta & { readonly updatedAt: number }
) {
  const currentRow = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularityCounters")
        .withIndex(
          "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
          (q) =>
            q
              .eq("windowKey", delta.windowKey)
              .eq("scopeMode", delta.scopeMode)
              .eq("content_id", delta.ref.content_id)
              .eq("contextKey", delta.context.contextKey)
        )
        .unique(),
    catch: toContentAnalyticsIoError,
  });

  if (!currentRow) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("learningPopularityCounters", {
          ...delta.ref,
          ...delta.context,
          description: delta.description,
          locale: delta.locale,
          materialDomain: delta.materialDomain,
          route: delta.route,
          score: delta.viewCount,
          section: delta.section,
          scopeMode: delta.scopeMode,
          sourcePath: delta.sourcePath,
          title: delta.title,
          updatedAt: delta.updatedAt,
          windowKey: delta.windowKey,
        }),
      catch: toContentAnalyticsIoError,
    });
    return;
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("learningPopularityCounters", currentRow._id, {
        ...delta.ref,
        ...delta.context,
        description: delta.description,
        locale: delta.locale,
        materialDomain: delta.materialDomain,
        route: delta.route,
        score: currentRow.score + delta.viewCount,
        section: delta.section,
        scopeMode: delta.scopeMode,
        sourcePath: delta.sourcePath,
        title: delta.title,
        updatedAt: delta.updatedAt,
        windowKey: delta.windowKey,
      }),
    catch: toContentAnalyticsIoError,
  });
});

/** Folds queued unique views into derived popularity tables. */
export const applyContentAnalyticsBatch = Effect.fn(
  "contents.metrics.applyContentAnalyticsBatch"
)(function* (
  ctx: MutationCtx,
  {
    queueItems,
    updatedAt,
  }: {
    readonly queueItems: readonly Doc<"learningEngagementQueue">[];
    readonly updatedAt: number;
  }
) {
  const batch = buildMetricsBatch(queueItems);

  for (const signal of batch.signals.values()) {
    yield* applySignal(ctx, { ...signal, updatedAt });
  }

  for (const counter of batch.counters.values()) {
    yield* applyCounter(ctx, { ...counter, updatedAt });
  }
});
