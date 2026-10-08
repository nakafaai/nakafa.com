import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { compactArtifacts } from "@repo/backend/confect/contentRelease/compact/artifacts";
import {
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/confect/contentRelease/model";
import { retainOrphanedArtifacts } from "@repo/backend/confect/contentRelease/retention";
import { compactSnapshots } from "@repo/backend/confect/contentRelease/snapshot/cleanup";
import {
  COMPACTION_HEAD_COUNT,
  COMPACTION_ITEM_COUNT,
  COMPACTION_PAGE_BYTES,
  COMPACTION_PAGE_COUNT,
} from "@repo/backend/confect/contentRelease/spec";
import { Array as Arr, Effect, flow, MutableHashSet, Schema } from "effect";

const compactionPage = {
  maximumBytesRead: COMPACTION_PAGE_BYTES,
  maximumRowsRead: COMPACTION_PAGE_COUNT,
  numItems: COMPACTION_PAGE_COUNT,
};
const headPage = {
  ...compactionPage,
  maximumRowsRead: COMPACTION_HEAD_COUNT,
  numItems: COMPACTION_HEAD_COUNT,
};
const itemPage = {
  ...compactionPage,
  maximumRowsRead: COMPACTION_ITEM_COUNT,
  numItems: COMPACTION_ITEM_COUNT,
};
const RowPageSchema = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  deleted: Schema.Finite,
  done: Schema.Boolean,
});
type RowPage = typeof RowPageSchema.Type;

/** Deletes one content version while retaining the exact floor anchor. */
const compactHead = Effect.fn("contentRelease.compactHead")(function* (
  row: Docs["contentHeads"],
  from: number,
  floor: number
) {
  const writer = yield* DatabaseWriter;
  // This transaction selected row inside the floor, so an anchor must exist.
  const anchor = yield* loadVersion(
    row.contentKey,
    row.artifactLocale,
    floor
  ).pipe(Effect.flatMap(flow(Effect.fromNullishOr, Effect.orDie)));
  let deleted = 0;
  const artifacts = MutableHashSet.empty<string>();
  if (anchor._id !== row._id) {
    yield* writer.table("contentHeads").delete(row._id);
    if (row.artifactHash) {
      MutableHashSet.add(artifacts, row.artifactHash);
    }
    deleted += 1;
  }
  const prior = yield* loadVersion(
    row.contentKey,
    row.artifactLocale,
    row.sequence - 1
  );
  if (prior && prior.sequence < from) {
    yield* writer.table("contentHeads").delete(prior._id);
    if (prior.artifactHash) {
      MutableHashSet.add(artifacts, prior.artifactHash);
    }
    deleted += 1;
  }
  yield* retainOrphanedArtifacts(artifacts);
  return deleted;
});

/** Deletes one route version while retaining the exact floor anchor. */
const compactBinding = Effect.fn("contentRelease.compactBinding")(function* (
  row: Docs["contentBindings"],
  from: number,
  floor: number
) {
  const writer = yield* DatabaseWriter;
  // This transaction selected row inside the floor, so an anchor must exist.
  const anchor = yield* loadRouteBinding(
    row.appLocale,
    row.publicPath,
    floor
  ).pipe(Effect.flatMap(flow(Effect.fromNullishOr, Effect.orDie)));
  let deleted = 0;
  if (anchor._id !== row._id) {
    yield* writer.table("contentBindings").delete(row._id);
    deleted += 1;
  }
  const prior = yield* loadRouteBinding(
    row.appLocale,
    row.publicPath,
    row.sequence - 1
  );
  if (prior && prior.sequence < from) {
    yield* writer.table("contentBindings").delete(prior._id);
    deleted += 1;
  }
  return deleted;
});

/** Compacts one bounded immutable content-version page. */
const compactHeads = Effect.fn("contentRelease.compactHeads")(function* (
  from: number,
  floor: number,
  cursor: null | string
) {
  const database = yield* DatabaseReader;
  const page = yield* database
    .table("contentHeads")
    .index("by_sequence", (query) =>
      query.gte("sequence", from).lte("sequence", floor)
    )
    .paginate({
      ...headPage,
      cursor,
    })
    .pipe(Effect.orDie);
  let deleted = 0;
  for (const row of page.page) {
    deleted += yield* compactHead(row, from, floor);
  }
  return {
    cursor: page.isDone ? null : page.continueCursor,
    deleted,
    done: page.isDone,
  } satisfies RowPage;
});

/** Compacts one bounded immutable route-version page. */
const compactBindings = Effect.fn("contentRelease.compactBindings")(function* (
  from: number,
  floor: number,
  cursor: null | string
) {
  const database = yield* DatabaseReader;
  const page = yield* database
    .table("contentBindings")
    .index("by_sequence", (query) =>
      query.gte("sequence", from).lte("sequence", floor)
    )
    .paginate({
      ...compactionPage,
      cursor,
    })
    .pipe(Effect.orDie);
  let deleted = 0;
  for (const row of page.page) {
    deleted += yield* compactBinding(row, from, floor);
  }
  return {
    cursor: page.isDone ? null : page.continueCursor,
    deleted,
    done: page.isDone,
  } satisfies RowPage;
});

/** Deletes one bounded obsolete release-item page. */
const compactItems = Effect.fn("contentRelease.compactItems")(function* (
  from: number,
  floor: number,
  cursor: null | string
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const page = yield* database
    .table("contentItems")
    .index("by_sequence", (query) =>
      query.gte("sequence", from).lt("sequence", floor)
    )
    .paginate({
      ...itemPage,
      cursor,
    })
    .pipe(Effect.orDie);
  for (const row of page.page) {
    yield* writer.table("contentItems").delete(row._id);
  }
  yield* retainOrphanedArtifacts(
    Arr.flatMap(page.page, ({ artifactHash }) =>
      artifactHash === undefined ? [] : [artifactHash]
    )
  );
  return {
    cursor: page.isDone ? null : page.continueCursor,
    deleted: page.page.length,
    done: page.isDone,
  } satisfies RowPage;
});

/** Deletes one bounded obsolete snapshot-ledger page. */
const compactBatches = Effect.fn("contentRelease.compactSnapshotBatches")(
  function* (from: number, floor: number, cursor: null | string) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const page = yield* database
      .table("snapshotBatches")
      .index("by_sequence_and_family_and_batchIndex", (query) =>
        query.gte("sequence", from).lt("sequence", floor)
      )
      .paginate({
        ...compactionPage,
        cursor,
      })
      .pipe(Effect.orDie);
    for (const row of page.page) {
      yield* writer.table("snapshotBatches").delete(row._id);
    }
    return {
      cursor: page.isDone ? null : page.continueCursor,
      deleted: page.page.length,
      done: page.isDone,
    } satisfies RowPage;
  }
);

/** Deletes one bounded obsolete release-record page after dependent rows. */
const compactReleases = Effect.fn("contentRelease.compactReleases")(function* (
  from: number,
  floor: number,
  cursor: null | string
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const page = yield* database
    .table("contentReleases")
    .index("by_sequence", (query) =>
      query.gte("sequence", from).lt("sequence", floor)
    )
    .paginate({
      ...compactionPage,
      cursor,
    })
    .pipe(Effect.orDie);
  for (const row of page.page) {
    yield* writer.table("contentReleases").delete(row._id);
  }
  return {
    cursor: page.isDone ? null : page.continueCursor,
    deleted: page.page.length,
    done: page.isDone,
  } satisfies RowPage;
});

/** Runs one persisted bounded page for the current compaction phase. */
export const compactRows = Effect.fn("contentRelease.compactRows")(function* (
  phase: NonNullable<Docs["contentState"]["compactPhase"]>,
  from: number,
  floor: number,
  cursor: null | string,
  startedAt: number
) {
  if (phase === "heads") {
    return yield* compactHeads(from, floor, cursor);
  }
  if (phase === "bindings") {
    return yield* compactBindings(from, floor, cursor);
  }
  if (phase === "items") {
    return yield* compactItems(from, floor, cursor);
  }
  if (phase === "batches") {
    return yield* compactBatches(from, floor, cursor);
  }
  if (phase === "facts") {
    return yield* compactArtifacts(cursor, startedAt);
  }
  if (phase === "snapshots") {
    return yield* compactSnapshots(startedAt);
  }
  return yield* compactReleases(from, floor, cursor);
});
