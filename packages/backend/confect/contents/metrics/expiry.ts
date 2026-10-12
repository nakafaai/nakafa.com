import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type { ExpireLearningPopularityWindowPageArgs } from "@repo/backend/confect/contents/analytics/spec";
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
  getPopularitySignalDay,
  getPopularityWindowStartDay,
  POPULARITY_DAY_MS,
  POPULARITY_SCOPE,
  POPULARITY_WINDOW,
} from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import { Clock, Duration, Effect, flow, Struct } from "effect";

type PopularityCounter = Docs["learningPopularityCounters"];
/** Loads the one daily signal leaving the popularity window. */
const loadExpiringSignal = Effect.fn("contents.metrics.loadExpiringSignal")(
  function* (counter: PopularityCounter, day: number) {
    const database = yield* DatabaseReader;
    const signalDay = getPopularityWindowStartDay(day) - POPULARITY_DAY_MS;
    return yield* database
      .table("learningPopularitySignals")
      .get(
        "by_scopeMode_and_content_id_and_contextKey_and_signalDay",
        counter.scopeMode,
        counter.content_id,
        counter.contextKey,
        signalDay
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/** Subtracts the exact outgoing contribution or repairs detected drift. */
const expirePopularityCounter = Effect.fn(
  "contents.metrics.expirePopularityCounter"
)(
  function* (counter: PopularityCounter, day: number, updatedAt: number) {
    const ctx = yield* MutationCtxService;
    const writer = yield* DatabaseWriter;
    const signal = yield* loadExpiringSignal(counter, day);
    const expiredCount = signal ? signal.applied.d7 : 0;
    const score = counter.score - expiredCount;
    if (expiredCount < 0 || score < 0) {
      const repair = yield* repairPopularityCounter(counter, day, updatedAt);
      return {
        expired: false,
        removed: repair.removed,
        repaired: true,
      };
    }
    if (expiredCount === 0) {
      return {
        expired: false,
        removed: false,
        repaired: false,
      };
    }
    if (score === 0) {
      yield* writer.table("learningPopularityCounters").delete(counter._id);
      yield* Effect.tryPromise({
        try: () => learningPopularityRankings.delete(ctx, counter),
        catch: toContentAnalyticsIoError,
      });
      return {
        expired: true,
        removed: true,
        repaired: false,
      };
    }
    yield* writer
      .table("learningPopularityCounters")
      .replace(counter._id, {
        ...Struct.omit(counter, ["_id", "_creationTime"]),
        score,
        updatedAt,
      })
      .pipe(Effect.orDie);
    yield* Effect.tryPromise({
      try: () =>
        learningPopularityRankings.replace(ctx, counter, {
          ...counter,
          score,
          updatedAt,
        }),
      catch: toContentAnalyticsIoError,
    });
    return {
      expired: true,
      removed: false,
      repaired: false,
    };
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/** Claims and schedules the daily maintenance job of the maintained ranking. */
export const scheduleLearningPopularityExpiries = Effect.fn(
  "contents.metrics.scheduleLearningPopularityExpiries"
)(function* () {
  const timestamp = yield* Clock.currentTimeMillis;
  const day = getPopularitySignalDay(timestamp);
  const cycle = yield* beginPopularityCycle({
    day,
    forceRepair: false,
    scopeMode: POPULARITY_SCOPE,
    windowKey: POPULARITY_WINDOW,
  });
  if (cycle.mode === "skipped") {
    return {
      expiryWindows: 0,
      repairWindows: 0,
      skippedWindows: 1,
    };
  }
  const reference =
    cycle.mode === "expiry"
      ? refs.internal.contents.mutations.popularity
          .expireLearningPopularityWindowPage
      : refs.internal.contents.mutations.popularity
          .refreshLearningPopularityWindowPage;
  const scheduler = yield* Scheduler;
  yield* scheduler
    .runAfter(Duration.zero, reference, {
      ...(cycle.cursor === undefined
        ? {}
        : {
            cursor: cycle.cursor,
          }),
      day,
      scopeMode: POPULARITY_SCOPE,
      windowKey: POPULARITY_WINDOW,
    })
    .pipe(Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail)));
  return {
    expiryWindows: cycle.mode === "expiry" ? 1 : 0,
    repairWindows: cycle.mode === "repair" ? 1 : 0,
    skippedWindows: 0,
  };
});

/** Expires one bounded counter page using one indexed signal read per row. */
export const expireLearningPopularityWindowPage = Effect.fn(
  "contents.metrics.expireLearningPopularityWindowPage"
)(
  function* (args: ExpireLearningPopularityWindowPageArgs) {
    const scheduler = yield* Scheduler;
    const database = yield* DatabaseReader;
    const cycle = yield* getPopularityCyclePage({
      ...Struct.pick(args, ["cursor"]),
      day: args.day,
      mode: "expiry",
      scopeMode: args.scopeMode,
      windowKey: args.windowKey,
    });
    if (!cycle.current) {
      return {
        continueCursor: cycle.continueCursor,
        expiredCounters: 0,
        isDone: true,
        removedCounters: 0,
        repairedCounters: 0,
        skipped: true,
      };
    }
    const updatedAt = yield* Clock.currentTimeMillis;
    const page = yield* database
      .table("learningPopularityCounters")
      .index("by_windowKey_and_scopeMode_and_content_id_and_contextKey", (q) =>
        q.eq("windowKey", args.windowKey).eq("scopeMode", args.scopeMode)
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: LEARNING_POPULARITY_REFRESH_BATCH_SIZE,
      })
      .pipe(Effect.orDie);
    let expiredCounters = 0;
    let removedCounters = 0;
    let repairedCounters = 0;
    for (const counter of page.page) {
      const result = yield* expirePopularityCounter(
        counter,
        args.day,
        updatedAt
      );
      if (result.expired) {
        expiredCounters += 1;
      }
      if (result.removed) {
        removedCounters += 1;
      }
      if (result.repaired) {
        repairedCounters += 1;
      }
    }
    if (page.isDone) {
      yield* completePopularityCycle(cycle.cycle, args.day);
    } else {
      yield* advancePopularityCycle(cycle.cycle, page.continueCursor);
      yield* scheduler
        .runAfter(
          Duration.millis(0),
          refs.internal.contents.mutations.popularity
            .expireLearningPopularityWindowPage,
          {
            cursor: page.continueCursor,
            day: args.day,
            scopeMode: args.scopeMode,
            windowKey: args.windowKey,
          }
        )
        .pipe(Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail)));
    }
    return {
      continueCursor: page.continueCursor,
      expiredCounters,
      isDone: page.isDone,
      removedCounters,
      repairedCounters,
      skipped: false,
    };
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);
