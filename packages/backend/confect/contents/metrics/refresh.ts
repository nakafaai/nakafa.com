import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type { RefreshLearningPopularityWindowPageArgs } from "@repo/backend/confect/contents/analytics/spec";
import { toContentAnalyticsIoError } from "@repo/backend/confect/contents/analytics/spec";
import { LEARNING_POPULARITY_REFRESH_BATCH_SIZE } from "@repo/backend/confect/contents/constants";
import {
  advancePopularityCycle,
  beginPopularityCycle,
  completePopularityCycle,
  getPopularityCyclePage,
} from "@repo/backend/confect/contents/metrics/cycle";
import { repairPopularityCounter } from "@repo/backend/confect/contents/metrics/repair";
import {
  getFinitePopularityWindows,
  getPopularitySignalDay,
  learningPopularityScopeValues,
} from "@repo/backend/confect/contents/popularity";
import { Clock, Duration, Effect, flow, Struct } from "effect";

/** Generated internal mutation reference accepted by Convex refresh scheduling. */

/** Schedules bounded repair work for every finite popularity namespace. */
export const scheduleLearningPopularityRefreshes = Effect.fn(
  "contents.metrics.scheduleLearningPopularityRefreshes"
)(function* () {
  const scheduler = yield* Scheduler;
  const timestamp = yield* Clock.currentTimeMillis;
  const day = getPopularitySignalDay(timestamp);
  let scheduledWindows = 0;
  for (const scopeMode of learningPopularityScopeValues) {
    for (const windowKey of getFinitePopularityWindows()) {
      const cycle = yield* beginPopularityCycle({
        day,
        forceRepair: true,
        scopeMode,
        windowKey,
      });
      if (cycle.mode === "skipped") {
        continue;
      }
      yield* scheduler
        .runAfter(
          Duration.millis(0),
          refs.internal.contents.mutations.popularity
            .refreshLearningPopularityWindowPage,
          {
            ...(cycle.cursor === undefined
              ? {}
              : {
                  cursor: cycle.cursor,
                }),
            day,
            scopeMode,
            windowKey,
          }
        )
        .pipe(Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail)));
      scheduledWindows += 1;
    }
  }
  return {
    scheduledWindows,
  };
});

/** Repairs finite counters from their durable lifetime identity registry. */
export const refreshLearningPopularityWindowPage = Effect.fn(
  "contents.metrics.refreshLearningPopularityWindowPage"
)(
  function* (args: RefreshLearningPopularityWindowPageArgs) {
    const scheduler = yield* Scheduler;
    const database = yield* DatabaseReader;
    const timestamp = yield* Clock.currentTimeMillis;
    const cycle = yield* getPopularityCyclePage({
      ...Struct.pick(args, ["cursor"]),
      day: args.day,
      mode: "repair",
      scopeMode: args.scopeMode,
      windowKey: args.windowKey,
    });
    if (!cycle.current) {
      return {
        continueCursor: cycle.continueCursor,
        isDone: true,
        refreshedCounters: 0,
        removedCounters: 0,
        skipped: true,
      };
    }
    const page = yield* database
      .table("learningPopularityCounters")
      .index("by_windowKey_and_scopeMode_and_content_id_and_contextKey", (q) =>
        q.eq("windowKey", "lifetime").eq("scopeMode", args.scopeMode)
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: LEARNING_POPULARITY_REFRESH_BATCH_SIZE,
      })
      .pipe(Effect.orDie);
    let refreshedCounters = 0;
    let removedCounters = 0;
    for (const counter of page.page) {
      const result = yield* repairPopularityCounter(
        counter,
        args.windowKey,
        args.day,
        timestamp
      );
      if (result.refreshed) {
        refreshedCounters += 1;
      }
      if (result.removed) {
        removedCounters += 1;
      }
    }
    if (!page.isDone) {
      yield* advancePopularityCycle(cycle.cycle, page.continueCursor);
      yield* scheduler
        .runAfter(
          Duration.millis(0),
          refs.internal.contents.mutations.popularity
            .refreshLearningPopularityWindowPage,
          {
            cursor: page.continueCursor,
            day: args.day,
            scopeMode: args.scopeMode,
            windowKey: args.windowKey,
          }
        )
        .pipe(Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail)));
    }
    if (page.isDone) {
      yield* completePopularityCycle(cycle.cycle, args.day);
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      refreshedCounters,
      removedCounters,
      skipped: false,
    };
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);
