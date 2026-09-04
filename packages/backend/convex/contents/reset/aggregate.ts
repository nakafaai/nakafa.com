import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import {
  type LearningPopularityRankingNamespace,
  learningPopularityRankings,
} from "@repo/backend/convex/contents/rankings";
import { hasPopularityResetRows } from "@repo/backend/convex/contents/reset/page";
import type {
  AggregatePopularityResetArgs,
  AggregatePopularityResetReference,
  PopularityResetPageReference,
  PopularityResetReport,
  VerifyPopularityResetReference,
} from "@repo/backend/convex/contents/reset/spec";
import { loadPopularityControl } from "@repo/backend/convex/contents/reset/state";
import { Clock, Effect } from "effect";

const POPULARITY_RESET_NAMESPACE_SIZE = 16;
const POPULARITY_RESET_VERIFY_DELAY_MS = 60_000;

const hasTableRow = Effect.fn("contents.reset.hasTableRow")(function* <
  TableName extends
    | "contentAnalyticsPartitions"
    | "learningEngagementQueue"
    | "learningPopularityCounters"
    | "learningPopularitySignals"
    | "learningPopularityViewerSignals",
>(ctx: QueryCtx, table: TableName) {
  const row = yield* Effect.tryPromise({
    try: () => ctx.db.query(table).first(),
    catch: toContentAnalyticsIoError,
  });
  return row !== null;
});

/** Serializes the full namespace tuple without delimiter collisions. */
function createNamespaceKey(namespace: LearningPopularityRankingNamespace) {
  return JSON.stringify(namespace);
}

/** Clears one aggregate namespace or advances the persisted bounded sweep. */
export const runPopularityResetAggregate = Effect.fn(
  "contents.reset.runPopularityResetAggregate"
)(function* (
  ctx: MutationCtx,
  args: AggregatePopularityResetArgs,
  resetAggregate: AggregatePopularityResetReference,
  verifyReset: VerifyPopularityResetReference
) {
  const control = yield* loadPopularityControl(ctx.db);
  if (!control) {
    return { cleared: 0, cursor: "", isDone: false };
  }

  const namespaces = yield* Effect.tryPromise({
    try: () =>
      learningPopularityRankings.paginateNamespaces(
        ctx,
        args.cursor,
        POPULARITY_RESET_NAMESPACE_SIZE
      ),
    catch: toContentAnalyticsIoError,
  });
  const cleared = new Set(control.cleared);
  const namespace = namespaces.page.find(
    (candidate) => !cleared.has(createNamespaceKey(candidate))
  );

  if (namespace !== undefined) {
    const key = createNamespaceKey(namespace);
    yield* Effect.tryPromise({
      try: () => learningPopularityRankings.clear(ctx, { namespace }),
      catch: toContentAnalyticsIoError,
    });
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(control._id, { cleared: [...control.cleared, key] }),
      catch: toContentAnalyticsIoError,
    });
    yield* Effect.tryPromise({
      try: () => ctx.scheduler.runAfter(0, resetAggregate, {}),
      catch: toContentAnalyticsIoError,
    });
    return { cleared: 1, cursor: "", isDone: false };
  }

  if (!namespaces.isDone) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.scheduler.runAfter(0, resetAggregate, {
          cursor: namespaces.cursor,
        }),
      catch: toContentAnalyticsIoError,
    });
    return { cleared: 0, cursor: namespaces.cursor, isDone: false };
  }

  yield* Effect.tryPromise({
    try: () =>
      ctx.scheduler.runAfter(POPULARITY_RESET_VERIFY_DELAY_MS, verifyReset, {}),
    catch: toContentAnalyticsIoError,
  });
  return { cleared: 0, cursor: namespaces.cursor, isDone: true };
});

/** Rechecks all owned tables after the aggregate sweep and quiet period. */
export const verifyPopularityReset = Effect.fn(
  "contents.reset.verifyPopularityReset"
)(function* (ctx: MutationCtx, resetPage: PopularityResetPageReference) {
  const control = yield* loadPopularityControl(ctx.db);
  if (!control) {
    return { restarted: false };
  }

  if (yield* hasPopularityResetRows(ctx.db)) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(control._id, {
          cleared: [],
          completedAt: undefined,
        }),
      catch: toContentAnalyticsIoError,
    });
    yield* Effect.tryPromise({
      try: () => ctx.scheduler.runAfter(0, resetPage, {}),
      catch: toContentAnalyticsIoError,
    });
    return { restarted: true };
  }

  const completedAt = yield* Clock.currentTimeMillis;
  yield* Effect.tryPromise({
    try: () => ctx.db.patch(control._id, { completedAt }),
    catch: toContentAnalyticsIoError,
  });
  return { restarted: false };
});

/** Reports the reset latch plus direct emptiness checks for all owned tables. */
export const getPopularityResetReport = Effect.fn(
  "contents.reset.getPopularityResetReport"
)(function* (ctx: QueryCtx) {
  const control = yield* loadPopularityControl(ctx.db);
  const [queue, partitions, viewerSignals, signals, counters] =
    yield* Effect.all([
      hasTableRow(ctx, "learningEngagementQueue"),
      hasTableRow(ctx, "contentAnalyticsPartitions"),
      hasTableRow(ctx, "learningPopularityViewerSignals"),
      hasTableRow(ctx, "learningPopularitySignals"),
      hasTableRow(ctx, "learningPopularityCounters"),
    ]);
  const queueEmpty = !queue;
  const partitionsEmpty = !partitions;
  const viewerSignalsEmpty = !viewerSignals;
  const signalsEmpty = !signals;
  const countersEmpty = !counters;
  const aggregateEmpty = control?.completedAt !== undefined;
  const complete =
    aggregateEmpty &&
    queueEmpty &&
    partitionsEmpty &&
    viewerSignalsEmpty &&
    signalsEmpty &&
    countersEmpty;

  return {
    aggregate: {
      cleared: control?.cleared.length ?? 0,
      empty: aggregateEmpty,
    },
    complete,
    resetting: control?.mode === "reset",
    tables: {
      countersEmpty,
      partitionsEmpty,
      queueEmpty,
      signalsEmpty,
      viewerSignalsEmpty,
    },
  } satisfies PopularityResetReport;
});
