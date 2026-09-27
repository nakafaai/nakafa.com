import { DatabaseReader, DatabaseWriter, Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { toContentAnalyticsIoError } from "@repo/backend/confect/contents/analytics/spec";
import {
  getFinitePopularityWindows,
  getPopularitySignalDay,
  getPopularityWindowStartDay,
  learningPopularityScopeValues,
} from "@repo/backend/confect/contents/popularity";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Duration, Effect, flow, Option } from "effect";

const PAGE_SIZE = 128;
/** Every finite window must have consumed its outgoing day before deletion. */
const hasCompletedWindows = Effect.fn("contents.metrics.hasCompletedWindows")(
  function* (ctx: MutationCtx, day: number) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    for (const scopeMode of learningPopularityScopeValues) {
      for (const windowKey of getFinitePopularityWindows()) {
        const cycle = yield* database
          .table("learningPopularityCycles")
          .get("by_scopeMode_and_windowKey", scopeMode, windowKey)
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
            Effect.orDie
          );
        if (cycle?.completedDay !== day) {
          return false;
        }
      }
    }
    return true;
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/**
 * Expires deduplication keys and finite-window inputs in bounded transactions.
 * Queue payloads own pending work; lifetime counters own processed totals.
 * The earliest indexed rows are the cursor, so retries need no checkpoint.
 */
export const pruneLearningPopularity = Effect.fn(
  "contents.metrics.pruneLearningPopularity"
)(
  function* (ctx: MutationCtx) {
    const scheduler = yield* Scheduler.Scheduler.pipe(
      Effect.provide(Scheduler.layer(ctx.scheduler))
    );
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const day = getPopularitySignalDay(yield* Clock.currentTimeMillis);
    const viewers = yield* database
      .table("learningPopularityViewerSignals")
      .index("by_signalDay", (query) => query.lt("signalDay", day))
      .take(PAGE_SIZE)
      .pipe(Effect.orDie);
    const signalCutoff = getPopularityWindowStartDay("365d", day);
    const expiredSignal = yield* database
      .table("learningPopularitySignals")
      .index("by_signalDay", (query) => query.lt("signalDay", signalCutoff))
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    // Do not read maintenance rows when there are no expired daily inputs.
    const waitingForMaintenance =
      expiredSignal !== null && !(yield* hasCompletedWindows(ctx, day));
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
