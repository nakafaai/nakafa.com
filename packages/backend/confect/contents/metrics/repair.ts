import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { toContentAnalyticsIoError } from "@repo/backend/confect/contents/analytics/spec";
import {
  getPopularitySignalDay,
  getPopularityWindowStartDay,
  POPULARITY_WINDOW_DAYS,
} from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import { Array as Arr, Effect, flow, Struct } from "effect";

type PopularityCounter = Docs["learningPopularityCounters"];
type PopularitySignal = Docs["learningPopularitySignals"];

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

/** Loads bounded daily signal rows for one counter inside the window. */
const loadPopularitySignals = Effect.fn(
  "contents.metrics.loadPopularitySignals"
)(
  function* (counter: PopularityCounter, timestamp: number) {
    const database = yield* DatabaseReader;
    const currentDay = getPopularitySignalDay(timestamp);
    const startDay = getPopularityWindowStartDay(timestamp);
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
      .take(POPULARITY_WINDOW_DAYS)
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/** Recomputes one counter from its durable daily signal rows. */
const recomputePopularityCounter = Effect.fn(
  "contents.metrics.recomputePopularityCounter"
)(function* (counter: PopularityCounter, timestamp: number) {
  const signals = yield* loadPopularitySignals(counter, timestamp);
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

/**
 * Recomputes one existing seven-day counter from its daily signals, or removes
 * it when no signal of its window backs it any more. It never creates a
 * counter: the next view of a lesson that has none creates it with that view,
 * and the next repair restores its score from the signals.
 */
export const repairPopularityCounter = Effect.fn(
  "contents.metrics.repairPopularityCounter"
)(
  function* (counter: PopularityCounter, day: number, updatedAt: number) {
    const ctx = yield* MutationCtxService;
    const writer = yield* DatabaseWriter;
    const { latestSignal, score } = yield* recomputePopularityCounter(
      counter,
      day
    );
    if (latestSignal === null || score <= 0) {
      yield* writer.table("learningPopularityCounters").delete(counter._id);
      yield* Effect.tryPromise({
        try: () => learningPopularityRankings.delete(ctx, counter),
        catch: toContentAnalyticsIoError,
      });
      return {
        removed: true,
        refreshed: false,
      };
    }
    const update = projectPopularityRefresh(counter, latestSignal, score);
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
