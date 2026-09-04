import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import type { PopularitySignalDelta } from "@repo/backend/convex/contents/metrics/batch";
import {
  isPopularitySignalInWindow,
} from "@repo/backend/convex/contents/popularity";
import { Effect } from "effect";

type PopularitySignal = Doc<"learningPopularitySignals">;
type Applied = PopularitySignal["applied"];

/** Returns the batch count actually added to one finite-window counter. */
function getAppliedDelta(
  delta: PopularitySignalDelta & { readonly updatedAt: number },
  windowKey: keyof Applied
) {
  return isPopularitySignalInWindow({
    signalDay: delta.signalDay,
    timestamp: delta.updatedAt,
    windowKey,
  })
    ? delta.viewCount
    : 0;
}

/** Projects exact per-window contributions for a newly created daily signal. */
function createApplied(
  delta: PopularitySignalDelta & { readonly updatedAt: number }
): Applied {
  return {
    "1d": getAppliedDelta(delta, "1d"),
    "7d": getAppliedDelta(delta, "7d"),
    "14d": getAppliedDelta(delta, "14d"),
    "30d": getAppliedDelta(delta, "30d"),
    "90d": getAppliedDelta(delta, "90d"),
    "180d": getAppliedDelta(delta, "180d"),
    "365d": getAppliedDelta(delta, "365d"),
  };
}

/** Adds only the batch contribution that the event path applied. */
function mergeApplied(
  current: PopularitySignal,
  delta: PopularitySignalDelta & { readonly updatedAt: number }
): Applied {
  return {
    "1d": current.applied["1d"] + getAppliedDelta(delta, "1d"),
    "7d": current.applied["7d"] + getAppliedDelta(delta, "7d"),
    "14d": current.applied["14d"] + getAppliedDelta(delta, "14d"),
    "30d": current.applied["30d"] + getAppliedDelta(delta, "30d"),
    "90d": current.applied["90d"] + getAppliedDelta(delta, "90d"),
    "180d": current.applied["180d"] + getAppliedDelta(delta, "180d"),
    "365d": current.applied["365d"] + getAppliedDelta(delta, "365d"),
  };
}

/** Applies one verified daily popularity signal delta. */
export const applyPopularitySignal = Effect.fn(
  "contents.metrics.applyPopularitySignal"
)(function* (
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
          applied: createApplied(delta),
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
        applied: mergeApplied(currentRow, delta),
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
