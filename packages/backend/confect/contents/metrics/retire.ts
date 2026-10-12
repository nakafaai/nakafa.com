import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { toContentAnalyticsIoError } from "@repo/backend/confect/contents/analytics/spec";
import { LEARNING_POPULARITY_REFRESH_BATCH_SIZE } from "@repo/backend/confect/contents/constants";
import {
  POPULARITY_SCOPE,
  POPULARITY_WINDOW,
} from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import { Array as Arr, Effect, flow } from "effect";

const counterIndex =
  "by_windowKey_and_scopeMode_and_content_id_and_contextKey" as const;
const cycleIndex = "by_scopeMode_and_windowKey" as const;
const CYCLE_PAGE_SIZE = 16;

/**
 * Reads one bounded page of counters outside the maintained ranking: the other
 * windows sort before and after "7d", and the other scope sorts after "global".
 */
const loadObsoleteCounters = Effect.fn("contents.metrics.loadObsoleteCounters")(
  function* () {
    const database = yield* DatabaseReader;
    const counters = database.table("learningPopularityCounters");
    const earlier = yield* counters
      .index(counterIndex, (query) => query.lt("windowKey", POPULARITY_WINDOW))
      .take(LEARNING_POPULARITY_REFRESH_BATCH_SIZE)
      .pipe(Effect.orDie);
    if (earlier.length > 0) {
      return earlier;
    }
    const later = yield* counters
      .index(counterIndex, (query) => query.gt("windowKey", POPULARITY_WINDOW))
      .take(LEARNING_POPULARITY_REFRESH_BATCH_SIZE)
      .pipe(Effect.orDie);
    if (later.length > 0) {
      return later;
    }
    return yield* counters
      .index(counterIndex, (query) =>
        query
          .eq("windowKey", POPULARITY_WINDOW)
          .gt("scopeMode", POPULARITY_SCOPE)
      )
      .take(LEARNING_POPULARITY_REFRESH_BATCH_SIZE)
      .pipe(Effect.orDie);
  }
);

/** Reads the few maintenance watermarks of windows and scopes no longer run. */
const loadObsoleteCycles = Effect.fn("contents.metrics.loadObsoleteCycles")(
  function* () {
    const database = yield* DatabaseReader;
    const cycles = database.table("learningPopularityCycles");
    const otherScope = yield* cycles
      .index(cycleIndex, (query) => query.gt("scopeMode", POPULARITY_SCOPE))
      .take(CYCLE_PAGE_SIZE)
      .pipe(Effect.orDie);
    const earlier = yield* cycles
      .index(cycleIndex, (query) =>
        query
          .eq("scopeMode", POPULARITY_SCOPE)
          .lt("windowKey", POPULARITY_WINDOW)
      )
      .take(CYCLE_PAGE_SIZE)
      .pipe(Effect.orDie);
    const later = yield* cycles
      .index(cycleIndex, (query) =>
        query
          .eq("scopeMode", POPULARITY_SCOPE)
          .gt("windowKey", POPULARITY_WINDOW)
      )
      .take(CYCLE_PAGE_SIZE)
      .pipe(Effect.orDie);
    return Arr.appendAll(Arr.appendAll(otherScope, earlier), later);
  }
);

/**
 * Deletes one bounded page of what the pipeline no longer maintains: counters
 * of the retired windows and scope with their ranking entries, and the
 * maintenance watermarks of those windows. The index ranges are the resume
 * position, so an empty probe costs no document read.
 *
 * Temporary migration (ADR 0008). Exit: the hourly prune reports no retired
 * counter and no retired watermark on dev and on production. Cleanup: delete
 * this file, its call in `retention.ts`, the `retiredCounters` and
 * `retiredCycles` result fields and the retirement tests, then narrow the
 * stored window and scope values of popularity rows to the maintained ones.
 */
export const retireObsoletePopularity = Effect.fn(
  "contents.metrics.retireObsoletePopularity"
)(
  function* () {
    const ctx = yield* MutationCtxService;
    const writer = yield* DatabaseWriter;
    const counters = yield* loadObsoleteCounters();
    for (const counter of counters) {
      yield* writer.table("learningPopularityCounters").delete(counter._id);
      yield* Effect.tryPromise({
        try: () => learningPopularityRankings.deleteIfExists(ctx, counter),
        catch: toContentAnalyticsIoError,
      });
    }
    const cycles = yield* loadObsoleteCycles();
    for (const cycle of cycles) {
      yield* writer.table("learningPopularityCycles").delete(cycle._id);
    }
    return {
      retiredCounters: counters.length,
      retiredCycles: cycles.length,
    };
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);
