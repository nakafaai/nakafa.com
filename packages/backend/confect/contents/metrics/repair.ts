import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { toContentAnalyticsIoError } from "@repo/backend/confect/contents/analytics/spec";
import {
  getPopularitySignalDay,
  getPopularityWindowDayCount,
  getPopularityWindowStartDay,
  type LearningPopularityFiniteWindow,
} from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import { Array as Arr, Effect, flow, Struct } from "effect";

type PopularityCounter = Docs["learningPopularityCounters"];
type PopularitySignal = Docs["learningPopularitySignals"];

/** Finds the finite counter owned by one durable popularity identity. */
const loadPopularityCounter = Effect.fn(
  "contents.metrics.loadPopularityCounter"
)(
  function* (
    identity: PopularityCounter,
    windowKey: LearningPopularityFiniteWindow
  ) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("learningPopularityCounters")
      .get(
        "by_windowKey_and_scopeMode_and_content_id_and_contextKey",
        windowKey,
        identity.scopeMode,
        identity.content_id,
        identity.contextKey
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/** Rebuilt semantics; `updatedAt` advances only when one of these changes. */
const refreshFields = [
  "alignmentId",
  "assetId",
  "conceptId",
  "contextMaterialKey",
  "contextMode",
  "contextNodeKey",
  "contextParentPath",
  "contextProgramKey",
  "contextPublicPath",
  "contextSourcePath",
  "description",
  "latestDay",
  "learningObjectId",
  "lensId",
  "materialDomain",
  "route",
  "score",
  "sourcePath",
  "title",
] as const satisfies readonly (keyof PopularityCounter)[];
type Refresh = Pick<PopularityCounter, (typeof refreshFields)[number]>;

/** Loads bounded daily signal rows for one counter and finite window. */
const loadPopularitySignals = Effect.fn(
  "contents.metrics.loadPopularitySignals"
)(
  function* (
    counter: PopularityCounter,
    windowKey: LearningPopularityFiniteWindow,
    timestamp: number
  ) {
    const database = yield* DatabaseReader;
    const currentDay = getPopularitySignalDay(timestamp);
    const startDay = getPopularityWindowStartDay(windowKey, timestamp);
    const dayCount = getPopularityWindowDayCount(windowKey);
    return yield* database
      .table("learningPopularitySignals")
      .index("by_scopeMode_and_content_id_and_contextKey_and_signalDay", (q) =>
        q
          .eq("scopeMode", counter.scopeMode)
          .eq("content_id", counter.content_id)
          .eq("contextKey", counter.contextKey)
          .gte("signalDay", startDay)
          .lte("signalDay", currentDay)
      )
      .take(dayCount)
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/** Recomputes one finite-window counter from durable daily signal rows. */
const recomputePopularityCounter = Effect.fn(
  "contents.metrics.recomputePopularityCounter"
)(function* (
  counter: PopularityCounter,
  windowKey: LearningPopularityFiniteWindow,
  timestamp: number
) {
  const signals = yield* loadPopularitySignals(counter, windowKey, timestamp);
  let latestSignal: PopularitySignal | null = null;
  let score = 0;
  for (const signal of signals) {
    score += signal.viewCount;
    latestSignal = signal;
  }
  return {
    latestSignal,
    score,
  };
});

/** Projects the stored counter state produced by one authoritative rebuild. */
function projectPopularityRefresh(
  counter: PopularityCounter,
  latestSignal: PopularitySignal,
  score: number
): Refresh {
  return {
    ...Struct.pick(
      {
        ...counter,
        ...latestSignal,
      },
      refreshFields
    ),
    latestDay: latestSignal.signalDay,
    score,
  };
}

/** Rebuilds or recreates one finite counter from authoritative daily signals. */
export const repairPopularityCounter = Effect.fn(
  "contents.metrics.repairPopularityCounter"
)(
  function* (
    identity: PopularityCounter,
    windowKey: LearningPopularityFiniteWindow,
    day: number,
    updatedAt: number
  ) {
    const ctx = yield* MutationCtxService;
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const counter =
      identity.windowKey === windowKey
        ? identity
        : yield* loadPopularityCounter(identity, windowKey);
    const { latestSignal, score } = yield* recomputePopularityCounter(
      identity,
      windowKey,
      day
    );
    if (latestSignal === null || score <= 0) {
      if (counter) {
        yield* writer.table("learningPopularityCounters").delete(counter._id);
        yield* Effect.tryPromise({
          try: () => learningPopularityRankings.delete(ctx, counter),
          catch: toContentAnalyticsIoError,
        });
      }
      return {
        removed: counter !== null,
        refreshed: false,
      };
    }
    const update = projectPopularityRefresh(
      counter ?? identity,
      latestSignal,
      score
    );
    if (!counter) {
      const counterId = yield* writer
        .table("learningPopularityCounters")
        .insert({
          ...update,
          content_id: identity.content_id,
          contextKey: identity.contextKey,
          locale: latestSignal.locale,
          scopeMode: identity.scopeMode,
          section: latestSignal.section,
          updatedAt,
          windowKey,
        })
        .pipe(Effect.orDie);
      const inserted = yield* database
        .table("learningPopularityCounters")
        .get(counterId)
        .pipe(Effect.orDie);
      yield* Effect.tryPromise({
        try: () => learningPopularityRankings.insert(ctx, inserted),
        catch: toContentAnalyticsIoError,
      });
      return {
        removed: false,
        refreshed: true,
      };
    }
    const changed = Arr.some(
      refreshFields,
      (field) => counter[field] !== update[field]
    );
    if (!changed) {
      return {
        removed: false,
        refreshed: false,
      };
    }
    yield* writer
      .table("learningPopularityCounters")
      .replace(counter._id, {
        ...Struct.omit(counter, ["_id", "_creationTime"]),
        ...update,
        updatedAt,
      })
      .pipe(Effect.orDie);
    yield* Effect.tryPromise({
      try: () =>
        learningPopularityRankings.replace(ctx, counter, {
          ...counter,
          ...update,
          updatedAt,
        }),
      catch: toContentAnalyticsIoError,
    });
    return {
      removed: false,
      refreshed: true,
    };
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);
