import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import learningPopularityCycles from "@repo/backend/confect/_generated/tables/learningPopularityCycles";
import { toContentAnalyticsIoError } from "@repo/backend/confect/contents/analytics/spec";
import {
  getPopularitySignalDay,
  POPULARITY_DAY_MS,
} from "@repo/backend/confect/contents/popularity";
import {
  learningPopularityFiniteWindowValidator,
  learningPopularityScopeValidator,
} from "@repo/backend/confect/contents/schema";
import { Clock, Effect, flow, Schema, Struct } from "effect";

const CycleKeySchema = Schema.Struct({
  day: Schema.Finite,
  scopeMode: learningPopularityScopeValidator,
  windowKey: learningPopularityFiniteWindowValidator,
});
type CycleKey = typeof CycleKeySchema.Type;
const CyclePageKeySchema = Schema.Struct({
  ...CycleKeySchema.fields,
  cursor: Schema.optionalKey(Schema.String),
  mode: learningPopularityCycles.Fields.fields.mode,
});
type CyclePageKey = typeof CyclePageKeySchema.Type;

/** Reads the unique maintenance watermark for one popularity namespace. */
const loadCycle = Effect.fn("contents.metrics.loadCycle")(
  function* (key: Omit<CycleKey, "day">) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("learningPopularityCycles")
      .get("by_scopeMode_and_windowKey", key.scopeMode, key.windowKey)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/** Claims one UTC maintenance day or resumes its durable next page. */
export const beginPopularityCycle = Effect.fn(
  "contents.metrics.beginPopularityCycle"
)(
  function* (
    key: CycleKey & {
      readonly forceRepair: boolean;
    }
  ) {
    const writer = yield* DatabaseWriter;
    const cycle = yield* loadCycle(key);
    if (
      cycle?.completedDay === key.day &&
      !(key.forceRepair && cycle.mode === "expiry")
    ) {
      return {
        mode: "skipped" as const,
      };
    }
    if (
      cycle?.startedDay === key.day &&
      !(key.forceRepair && cycle.mode === "expiry")
    ) {
      return {
        cursor: cycle.cursor,
        mode: cycle.mode,
      };
    }
    const mode =
      key.forceRepair || cycle?.completedDay !== key.day - POPULARITY_DAY_MS
        ? ("repair" as const)
        : ("expiry" as const);
    if (cycle) {
      yield* writer
        .table("learningPopularityCycles")
        .replace(cycle._id, {
          ...Struct.omit(cycle, [
            "_id",
            "_creationTime",
            "completedDay",
            "cursor",
          ]),
          mode,
          startedDay: key.day,
        })
        .pipe(Effect.orDie);
    } else {
      yield* writer
        .table("learningPopularityCycles")
        .insert({
          mode,
          scopeMode: key.scopeMode,
          startedDay: key.day,
          windowKey: key.windowKey,
        })
        .pipe(Effect.orDie);
    }
    return {
      cursor: undefined,
      mode,
    };
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/**
 * Validates one active page in the current UTC day. A previous-day page leaves
 * its cycle incomplete so the next daily schedule repairs every identity.
 */
export const getPopularityCyclePage = Effect.fn(
  "contents.metrics.getPopularityCyclePage"
)(function* (key: CyclePageKey) {
  const cycle = yield* loadCycle(key);
  const continueCursor = cycle?.cursor ?? "";
  const timestamp = yield* Clock.currentTimeMillis;
  if (
    key.day === getPopularitySignalDay(timestamp) &&
    cycle?.startedDay === key.day &&
    cycle.completedDay !== key.day &&
    cycle.mode === key.mode &&
    continueCursor === (key.cursor ?? "")
  ) {
    return {
      continueCursor,
      current: true as const,
      cycle,
    };
  }
  return {
    continueCursor,
    current: false as const,
  };
});

/** Persists the only cursor allowed to continue one active page chain. */
export const advancePopularityCycle = Effect.fn(
  "contents.metrics.advancePopularityCycle"
)(
  function* (cycle: Docs["learningPopularityCycles"], cursor: string) {
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("learningPopularityCycles")
      .replace(cycle._id, {
        ...Struct.omit(cycle, ["_id", "_creationTime"]),
        cursor,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);

/** Advances the completion watermark after the final claimed page. */
export const completePopularityCycle = Effect.fn(
  "contents.metrics.completePopularityCycle"
)(
  function* (cycle: Docs["learningPopularityCycles"], day: number) {
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("learningPopularityCycles")
      .replace(cycle._id, {
        ...Struct.omit(cycle, ["_id", "_creationTime", "cursor"]),
        completedDay: day,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toContentAnalyticsIoError, Effect.fail))
);
