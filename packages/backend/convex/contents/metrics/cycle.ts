import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import {
  type LearningPopularityScope,
  type LearningPopularityWindow,
  POPULARITY_DAY_MS,
} from "@repo/backend/convex/contents/popularity";
import { Effect } from "effect";

export type PopularityCycleMode = "expiry" | "repair";

interface CycleKey {
  readonly day: number;
  readonly scopeMode: LearningPopularityScope;
  readonly windowKey: LearningPopularityWindow;
}

interface CyclePageKey extends CycleKey {
  readonly cursor?: string;
  readonly mode: PopularityCycleMode;
}

/** Reads the unique maintenance watermark for one popularity namespace. */
const loadCycle = Effect.fn("contents.metrics.loadCycle")(function* (
  ctx: MutationCtx,
  key: Omit<CycleKey, "day">
) {
  return yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("learningPopularityCycles")
        .withIndex("by_scopeMode_and_windowKey", (q) =>
          q.eq("scopeMode", key.scopeMode).eq("windowKey", key.windowKey)
        )
        .unique(),
    catch: toContentAnalyticsIoError,
  });
});

/** Claims one UTC maintenance day or resumes its durable next page. */
export const beginPopularityCycle = Effect.fn(
  "contents.metrics.beginPopularityCycle"
)(function* (
  ctx: MutationCtx,
  key: CycleKey & { readonly forceRepair: boolean }
) {
  const cycle = yield* loadCycle(ctx, key);

  if (
    cycle?.completedDay === key.day &&
    !(key.forceRepair && cycle.mode === "expiry")
  ) {
    return { mode: "skipped" as const };
  }

  if (cycle?.startedDay === key.day) {
    if (!(key.forceRepair && cycle.mode === "expiry")) {
      return {
        cursor: cycle.cursor,
        mode: cycle.mode,
      };
    }
  }

  const mode =
    key.forceRepair || cycle?.completedDay !== key.day - POPULARITY_DAY_MS
      ? ("repair" as const)
      : ("expiry" as const);

  if (cycle) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(cycle._id, {
          completedDay: undefined,
          cursor: undefined,
          mode,
          startedDay: key.day,
        }),
      catch: toContentAnalyticsIoError,
    });
  } else {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("learningPopularityCycles", {
          mode,
          scopeMode: key.scopeMode,
          startedDay: key.day,
          windowKey: key.windowKey,
        }),
      catch: toContentAnalyticsIoError,
    });
  }

  return { cursor: undefined, mode };
});

/** Validates one exact active page and returns its durable recovery cursor. */
export const getPopularityCyclePage = Effect.fn(
  "contents.metrics.getPopularityCyclePage"
)(function* (ctx: MutationCtx, key: CyclePageKey) {
  const cycle = yield* loadCycle(ctx, key);
  const continueCursor = cycle?.cursor ?? "";

  if (
    cycle?.startedDay === key.day &&
    cycle.completedDay !== key.day &&
    cycle.mode === key.mode &&
    continueCursor === (key.cursor ?? "")
  ) {
    return {
      continueCursor,
      current: true as const,
      cycleId: cycle._id,
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
)(function* (
  ctx: MutationCtx,
  cycleId: Id<"learningPopularityCycles">,
  cursor: string
) {
  yield* Effect.tryPromise({
    try: () => ctx.db.patch(cycleId, { cursor }),
    catch: toContentAnalyticsIoError,
  });
});

/** Advances the completion watermark after the final claimed page. */
export const completePopularityCycle = Effect.fn(
  "contents.metrics.completePopularityCycle"
)(function* (
  ctx: MutationCtx,
  cycleId: Id<"learningPopularityCycles">,
  day: number
) {
  yield* Effect.tryPromise({
    try: () =>
      ctx.db.patch(cycleId, {
        completedDay: day,
        cursor: undefined,
      }),
    catch: toContentAnalyticsIoError,
  });
});
