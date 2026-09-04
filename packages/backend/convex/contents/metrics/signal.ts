import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import type { PopularitySignalDelta } from "@repo/backend/convex/contents/metrics/batch";
import {
  isPopularitySignalInWindow,
  type LearningPopularityFiniteWindow,
} from "@repo/backend/convex/contents/popularity";
import { Effect } from "effect";

type PopularitySignal = Doc<"learningPopularitySignals">;
type Applied = PopularitySignal["applied"];

const appliedField = {
  "1d": "d1",
  "7d": "d7",
  "14d": "d14",
  "30d": "d30",
  "90d": "d90",
  "180d": "d180",
  "365d": "d365",
} as const satisfies Record<LearningPopularityFiniteWindow, keyof Applied>;

/** Reads the contribution actually applied to one finite counter window. */
export function getAppliedCount(
  applied: Applied,
  windowKey: LearningPopularityFiniteWindow
) {
  return applied[appliedField[windowKey]];
}

/** Returns the batch count actually added to one finite-window counter. */
function getAppliedDelta(
  delta: PopularitySignalDelta & { readonly updatedAt: number },
  windowKey: LearningPopularityFiniteWindow
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
    d1: getAppliedDelta(delta, "1d"),
    d7: getAppliedDelta(delta, "7d"),
    d14: getAppliedDelta(delta, "14d"),
    d30: getAppliedDelta(delta, "30d"),
    d90: getAppliedDelta(delta, "90d"),
    d180: getAppliedDelta(delta, "180d"),
    d365: getAppliedDelta(delta, "365d"),
  };
}

/** Adds only the batch contribution that the event path applied. */
function mergeApplied(
  current: PopularitySignal,
  delta: PopularitySignalDelta & { readonly updatedAt: number }
): Applied {
  return {
    d1: current.applied.d1 + getAppliedDelta(delta, "1d"),
    d7: current.applied.d7 + getAppliedDelta(delta, "7d"),
    d14: current.applied.d14 + getAppliedDelta(delta, "14d"),
    d30: current.applied.d30 + getAppliedDelta(delta, "30d"),
    d90: current.applied.d90 + getAppliedDelta(delta, "90d"),
    d180: current.applied.d180 + getAppliedDelta(delta, "180d"),
    d365: current.applied.d365 + getAppliedDelta(delta, "365d"),
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
