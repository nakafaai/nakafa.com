import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import type { PopularityCounterDelta } from "@repo/backend/convex/contents/metrics/batch";
import { Effect } from "effect";

/** Projects counter payload from the newest queued signal day. */
function projectCounter(delta: PopularityCounterDelta) {
  return {
    ...delta.ref,
    ...delta.context,
    description: delta.description,
    latestDay: delta.latestDay,
    locale: delta.locale,
    materialDomain: delta.materialDomain,
    route: delta.route,
    section: delta.section,
    scopeMode: delta.scopeMode,
    sourcePath: delta.sourcePath,
    title: delta.title,
    windowKey: delta.windowKey,
  };
}

/** Applies one ranked popularity counter delta. */
export const applyPopularityCounter = Effect.fn(
  "contents.metrics.applyPopularityCounter"
)(function* (
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
          ...projectCounter(delta),
          score: delta.viewCount,
          updatedAt: delta.updatedAt,
        }),
      catch: toContentAnalyticsIoError,
    });
    return;
  }

  const newest =
    delta.latestDay >= currentRow.latestDay ? projectCounter(delta) : {};

  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch("learningPopularityCounters", currentRow._id, {
        ...newest,
        score: currentRow.score + delta.viewCount,
        updatedAt: delta.updatedAt,
      }),
    catch: toContentAnalyticsIoError,
  });
});
