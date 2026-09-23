import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import type { PopularityCounterDelta } from "@repo/backend/convex/contents/metrics/batch";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import { getOrThrow } from "convex-helpers/server/relationships";
import { Effect, Struct } from "effect";

/** Projects counter payload from the newest queued signal day. */
function projectCounter(delta: PopularityCounterDelta) {
  return {
    ...delta.ref,
    ...delta.context,
    ...(delta.description === undefined
      ? {}
      : { description: delta.description }),
    latestDay: delta.latestDay,
    locale: delta.locale,
    ...(delta.materialDomain === undefined
      ? {}
      : { materialDomain: delta.materialDomain }),
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
    const counterId = yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("learningPopularityCounters", {
          ...projectCounter(delta),
          score: delta.viewCount,
          updatedAt: delta.updatedAt,
        }),
      catch: toContentAnalyticsIoError,
    });
    const counter = yield* Effect.tryPromise({
      try: () => getOrThrow(ctx, "learningPopularityCounters", counterId),
      catch: toContentAnalyticsIoError,
    });
    yield* Effect.tryPromise({
      try: () => learningPopularityRankings.insert(ctx, counter),
      catch: toContentAnalyticsIoError,
    });
    return;
  }

  const projection =
    delta.latestDay >= currentRow.latestDay
      ? projectCounter(delta)
      : Struct.omit(currentRow, ["_id", "_creationTime"]);
  const updated = {
    ...projection,
    score: currentRow.score + delta.viewCount,
    updatedAt: delta.updatedAt,
  };

  // Replacement clears absent optional projection fields without an extra read.
  yield* Effect.tryPromise({
    try: () =>
      ctx.db.replace("learningPopularityCounters", currentRow._id, updated),
    catch: toContentAnalyticsIoError,
  });
  yield* Effect.tryPromise({
    try: () =>
      learningPopularityRankings.replace(ctx, currentRow, {
        ...updated,
        _id: currentRow._id,
        _creationTime: currentRow._creationTime,
      }),
    catch: toContentAnalyticsIoError,
  });
});
