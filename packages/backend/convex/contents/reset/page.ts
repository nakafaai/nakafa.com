import type {
  DataModel,
  TableNames,
} from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toContentAnalyticsIoError } from "@repo/backend/convex/contents/analytics/spec";
import type {
  AggregatePopularityResetReference,
  PopularityResetPageArgs,
  PopularityResetPageReference,
  PopularityResetTable,
  StartPopularityResetResult,
} from "@repo/backend/convex/contents/reset/spec";
import { loadPopularityControl } from "@repo/backend/convex/contents/reset/state";
import type {
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";
import { Clock, Effect } from "effect";

const POPULARITY_RESET_PAGE_BYTES = 2 * 1024 * 1024;
const POPULARITY_RESET_PAGE_SIZE = 32;
const popularityResetTargets = [
  { size: POPULARITY_RESET_PAGE_SIZE, table: "learningEngagementQueue" },
  { size: POPULARITY_RESET_PAGE_SIZE, table: "contentAnalyticsPartitions" },
  {
    size: POPULARITY_RESET_PAGE_SIZE,
    table: "learningPopularityViewerSignals",
  },
  { size: POPULARITY_RESET_PAGE_SIZE, table: "learningPopularitySignals" },
  { size: 1, table: "learningPopularityCounters" },
] as const satisfies readonly {
  readonly size: number;
  readonly table: TableNames;
}[];
const popularityResetTargetsByName = {
  counters: popularityResetTargets[4],
  partitions: popularityResetTargets[1],
  queue: popularityResetTargets[0],
  signals: popularityResetTargets[3],
  viewers: popularityResetTargets[2],
} as const satisfies Record<
  PopularityResetTable,
  (typeof popularityResetTargets)[number]
>;
const popularityResetNextTable = {
  counters: null,
  partitions: "viewers",
  queue: "partitions",
  signals: "counters",
  viewers: "signals",
} as const satisfies Record<PopularityResetTable, PopularityResetTable | null>;

/** Reads one explicitly byte- and row-bounded reset page. */
export const loadPopularityResetPage = Effect.fn(
  "contents.reset.loadPopularityResetPage"
)(function* <
  TableName extends (typeof popularityResetTargets)[number]["table"],
>(db: GenericDatabaseReader<DataModel>, table: TableName, size: number) {
  return yield* Effect.tryPromise({
    try: () =>
      db.query(table).paginate({
        cursor: null,
        maximumBytesRead: POPULARITY_RESET_PAGE_BYTES,
        maximumRowsRead: size,
        numItems: size,
      }),
    catch: toContentAnalyticsIoError,
  });
});

/** Deletes one bounded page through the trigger-aware mutation database. */
const deletePopularityResetPage = Effect.fn(
  "contents.reset.deletePopularityResetPage"
)(function* <
  TableName extends (typeof popularityResetTargets)[number]["table"],
>(db: GenericDatabaseWriter<DataModel>, table: TableName, size: number) {
  const page = yield* loadPopularityResetPage(db, table, size);

  for (const row of page.page) {
    yield* Effect.tryPromise({
      try: () => db.delete(table, row._id),
      catch: toContentAnalyticsIoError,
    });
  }

  return page.page.length;
});

/** Returns whether any reset-owned table still contains a row. */
export const hasPopularityResetRows = Effect.fn(
  "contents.reset.hasPopularityResetRows"
)(function* (db: GenericDatabaseReader<DataModel>) {
  for (const target of popularityResetTargets) {
    const row = yield* Effect.tryPromise({
      try: () => db.query(target.table).first(),
      catch: toContentAnalyticsIoError,
    });
    if (row !== null) {
      return true;
    }
  }
  return false;
});

/** Activates the reset latch before any destructive page is scheduled. */
export const startPopularityReset = Effect.fn(
  "contents.reset.startPopularityReset"
)(function* (ctx: MutationCtx, resetPage: PopularityResetPageReference) {
  const current = yield* loadPopularityControl(ctx.db);
  const started = current === null;
  const startedAt = yield* Clock.currentTimeMillis;

  if (current) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.patch(current._id, {
          cleared: [],
          completedAt: undefined,
          startedAt,
        }),
      catch: toContentAnalyticsIoError,
    });
  } else {
    yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("learningPopularityControl", {
          cleared: [],
          key: "popularity",
          mode: "reset",
          startedAt,
        }),
      catch: toContentAnalyticsIoError,
    });
  }

  yield* Effect.tryPromise({
    try: () => ctx.scheduler.runAfter(0, resetPage, {}),
    catch: toContentAnalyticsIoError,
  });

  return { scheduled: true, started } satisfies StartPopularityResetResult;
});

/** Deletes the first nonempty owned table page, then starts aggregate cleanup. */
export const runPopularityResetPage = Effect.fn(
  "contents.reset.runPopularityResetPage"
)(function* (
  ctx: MutationCtx,
  args: PopularityResetPageArgs,
  resetPage: PopularityResetPageReference,
  resetAggregate: AggregatePopularityResetReference
) {
  const table = args.table ?? "queue";
  const control = yield* loadPopularityControl(ctx.db);
  if (!control) {
    return { deleted: 0, done: false, table };
  }

  const target = popularityResetTargetsByName[table];
  const deleted = yield* deletePopularityResetPage(
    ctx.db,
    target.table,
    target.size
  );
  if (deleted !== 0) {
    yield* Effect.tryPromise({
      try: () => ctx.scheduler.runAfter(0, resetPage, { table }),
      catch: toContentAnalyticsIoError,
    });
    return { deleted, done: false, table };
  }

  const nextTable = popularityResetNextTable[table];
  if (nextTable !== null) {
    yield* Effect.tryPromise({
      try: () => ctx.scheduler.runAfter(0, resetPage, { table: nextTable }),
      catch: toContentAnalyticsIoError,
    });
    return { deleted: 0, done: false, table };
  }

  yield* Effect.tryPromise({
    try: () => ctx.scheduler.runAfter(0, resetAggregate, {}),
    catch: toContentAnalyticsIoError,
  });
  return { deleted: 0, done: true, table };
});
