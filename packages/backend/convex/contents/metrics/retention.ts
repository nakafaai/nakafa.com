import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  type PruneLearningPopularityResult,
  toContentAnalyticsIoError,
} from "@repo/backend/convex/contents/analytics/spec";
import {
  getFinitePopularityWindows,
  getPopularitySignalDay,
  getPopularityWindowStartDay,
  learningPopularityScopeValues,
} from "@repo/backend/convex/contents/popularity";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

const PAGE_SIZE = 128;

type PruneReference = FunctionReference<
  "mutation",
  "internal",
  Record<string, never>,
  PruneLearningPopularityResult
>;

/** Every finite window must have consumed its outgoing day before deletion. */
const hasCompletedWindows = Effect.fn("contents.metrics.hasCompletedWindows")(
  function* (ctx: MutationCtx, day: number) {
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
  }
);

/**
 * Expires deduplication keys and finite-window inputs in bounded transactions.
 * Queue payloads own pending work; lifetime counters own processed totals.
 * The earliest indexed rows are the cursor, so retries need no checkpoint.
 */
export const pruneLearningPopularity = Effect.fn(
  "contents.metrics.pruneLearningPopularity"
)(function* (ctx: MutationCtx, prune: PruneReference) {
  const day = getPopularitySignalDay(yield* Clock.currentTimeMillis);
  const viewers = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularityViewerSignals")
        .withIndex("by_signalDay", (query) => query.lt("signalDay", day))
        .take(PAGE_SIZE),
    catch: toContentAnalyticsIoError,
  });
  const signalCutoff = getPopularityWindowStartDay("365d", day);
  const expiredSignal = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularitySignals")
        .withIndex("by_signalDay", (query) =>
          query.lt("signalDay", signalCutoff)
        )
        .first(),
    catch: toContentAnalyticsIoError,
  });
  // Do not read maintenance rows when there are no expired daily inputs.
  const waitingForMaintenance =
    expiredSignal !== null && !(yield* hasCompletedWindows(ctx, day));

  for (const viewer of viewers) {
    yield* Effect.tryPromise({
      try: () => ctx.db.delete("learningPopularityViewerSignals", viewer._id),
      catch: toContentAnalyticsIoError,
    });
  }

  let signalsDeleted = 0;
  if (expiredSignal !== null && !waitingForMaintenance) {
    const signals = yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("learningPopularitySignals")
          .withIndex("by_signalDay", (query) =>
            query.lt("signalDay", signalCutoff)
          )
          .take(PAGE_SIZE),
      catch: toContentAnalyticsIoError,
    });
    for (const signal of signals) {
      yield* Effect.tryPromise({
        try: () => ctx.db.delete("learningPopularitySignals", signal._id),
        catch: toContentAnalyticsIoError,
      });
      signalsDeleted += 1;
    }
  }

  const hasMore = viewers.length === PAGE_SIZE || signalsDeleted === PAGE_SIZE;
  if (hasMore) {
    // Native scheduling and these deletions commit together. A failed page
    // rolls back; the hourly cron also recovers a terminated chain.
    yield* Effect.tryPromise({
      try: () => ctx.scheduler.runAfter(0, prune, {}),
      catch: toContentAnalyticsIoError,
    });
  }

  return {
    hasMore,
    signalsDeleted,
    viewersDeleted: viewers.length,
    waitingForMaintenance,
  };
});
