import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { toContentAnalyticsIoError } from "@repo/backend/confect/contents/analytics/spec";
import {
  getPopularitySignalDay,
  getPopularityWindowStartDay,
  POPULARITY_SCOPE,
  POPULARITY_WINDOW,
} from "@repo/backend/confect/contents/popularity";
import { Clock, Duration, Effect, flow, Option } from "effect";

const PAGE_SIZE = 128;
/** The maintained window must have consumed its outgoing day before deletion. */
const hasCompletedWindow = Effect.fn("contents.metrics.hasCompletedWindow")(
  function* (day: number) {
    const database = yield* DatabaseReader;
    const cycle = yield* database
      .table("learningPopularityCycles")
      .get("by_scopeMode_and_windowKey", POPULARITY_SCOPE, POPULARITY_WINDOW)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    return cycle?.completedDay === day;
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/**
 * Expires deduplication keys and window inputs in bounded transactions. Queue
 * payloads own pending work. A daily signal is kept only while the window can
 * still expire it, so the window start is the retention cutoff once the
 * window's own maintenance has completed the day. The earliest indexed rows are
 * the cursor, so retries need no checkpoint.
 */
export const pruneLearningPopularity = Effect.fn(
  "contents.metrics.pruneLearningPopularity"
)(
  function* () {
    const scheduler = yield* Scheduler;
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const day = getPopularitySignalDay(yield* Clock.currentTimeMillis);
    const viewers = yield* database
      .table("learningPopularityViewerSignals")
      .index("by_signalDay", (query) => query.lt("signalDay", day))
      .take(PAGE_SIZE)
      .pipe(Effect.orDie);
    const signalCutoff = getPopularityWindowStartDay(day);
    const expiredSignal = yield* database
      .table("learningPopularitySignals")
      .index("by_signalDay", (query) => query.lt("signalDay", signalCutoff))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    // Do not read maintenance rows when there are no expired daily inputs.
    const waitingForMaintenance =
      expiredSignal !== null && !(yield* hasCompletedWindow(day));
    for (const viewer of viewers) {
      yield* writer.table("learningPopularityViewerSignals").delete(viewer._id);
    }
    let signalsDeleted = 0;
    if (expiredSignal !== null && !waitingForMaintenance) {
      const signals = yield* database
        .table("learningPopularitySignals")
        .index("by_signalDay", (query) => query.lt("signalDay", signalCutoff))
        .take(PAGE_SIZE)
        .pipe(Effect.orDie);
      for (const signal of signals) {
        yield* writer.table("learningPopularitySignals").delete(signal._id);
        signalsDeleted += 1;
      }
    }
    const hasMore =
      viewers.length === PAGE_SIZE || signalsDeleted === PAGE_SIZE;
    if (hasMore) {
      // Native scheduling and these deletions commit together. A failed page
      // rolls back; the hourly cron also recovers a terminated chain.
      yield* scheduler
        .runAfter(
          Duration.millis(0),
          refs.internal.contents.mutations.popularity.pruneLearningPopularity,
          {}
        )
        .pipe(Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail)));
    }
    return {
      hasMore,
      signalsDeleted,
      viewersDeleted: viewers.length,
      waitingForMaintenance,
    };
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);
