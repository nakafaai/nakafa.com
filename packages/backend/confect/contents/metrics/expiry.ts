import { DatabaseReader, DatabaseWriter, Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
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
import { getAppliedCount } from "@repo/backend/confect/contents/metrics/signal";
import {
  getFinitePopularityWindows,
  getPopularitySignalDay,
  getPopularityWindowStartDay,
  type LearningPopularityFiniteWindow,
  learningPopularityScopeValues,
  POPULARITY_DAY_MS,
} from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Duration, Effect, flow, Struct } from "effect";

type PopularityCounter = Doc<"learningPopularityCounters">;
/** Loads the one daily signal leaving a finite popularity window. */
const loadExpiringSignal = Effect.fn("contents.metrics.loadExpiringSignal")(
  function* (
    ctx: MutationCtx,
    counter: PopularityCounter,
    windowKey: LearningPopularityFiniteWindow,
    day: number
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const signalDay =
      getPopularityWindowStartDay(windowKey, day) - POPULARITY_DAY_MS;
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
  function* (
    ctx: MutationCtx,
    counter: PopularityCounter,
    windowKey: LearningPopularityFiniteWindow,
    day: number,
    updatedAt: number
  ) {
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const signal = yield* loadExpiringSignal(ctx, counter, windowKey, day);
    const expiredCount = signal
      ? getAppliedCount(signal.applied, windowKey)
      : 0;
    const score = counter.score - expiredCount;
    if (expiredCount < 0 || score < 0) {
      const repair = yield* repairPopularityCounter(
        ctx,
        counter,
        windowKey,
        day,
        updatedAt
      );
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

/** Claims and schedules one daily maintenance job per finite namespace. */
export const scheduleLearningPopularityExpiries = Effect.fn(
  "contents.metrics.scheduleLearningPopularityExpiries"
)(function* (ctx: MutationCtx) {
  const timestamp = yield* Clock.currentTimeMillis;
  const day = getPopularitySignalDay(timestamp);
  let expiryWindows = 0;
  let repairWindows = 0;
  let skippedWindows = 0;
  for (const scopeMode of learningPopularityScopeValues) {
    for (const windowKey of getFinitePopularityWindows()) {
      const cycle = yield* beginPopularityCycle(ctx, {
        day,
        forceRepair: false,
        scopeMode,
        windowKey,
      });
      if (cycle.mode === "skipped") {
        skippedWindows += 1;
        continue;
      }
      const reference =
        cycle.mode === "expiry"
          ? refs.internal.contents.mutations.popularity
              .expireLearningPopularityWindowPage
          : refs.internal.contents.mutations.popularity
              .refreshLearningPopularityWindowPage;
      const scheduler = yield* Scheduler.Scheduler.pipe(
        Effect.provide(Scheduler.layer(ctx.scheduler))
      );
      yield* scheduler
        .runAfter(Duration.zero, reference, {
          ...(cycle.cursor === undefined ? {} : { cursor: cycle.cursor }),
          day,
          scopeMode,
          windowKey,
        })
        .pipe(Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail)));
      if (cycle.mode === "expiry") {
        expiryWindows += 1;
      } else {
        repairWindows += 1;
      }
    }
  }
  return {
    expiryWindows,
    repairWindows,
    skippedWindows,
  };
});

/** Expires one bounded counter page using one indexed signal read per row. */
export const expireLearningPopularityWindowPage = Effect.fn(
  "contents.metrics.expireLearningPopularityWindowPage"
)(
  function* (ctx: MutationCtx, args: ExpireLearningPopularityWindowPageArgs) {
    const scheduler = yield* Scheduler.Scheduler.pipe(
      Effect.provide(Scheduler.layer(ctx.scheduler))
    );
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const cycle = yield* getPopularityCyclePage(ctx, {
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
        ctx,
        counter,
        args.windowKey,
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
      yield* completePopularityCycle(ctx, cycle.cycle, args.day);
    } else {
      yield* advancePopularityCycle(ctx, cycle.cycle, page.continueCursor);
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
