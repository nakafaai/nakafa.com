import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { compactArtifacts } from "@repo/backend/convex/contentRelease/compact/artifacts";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import { retainOrphanedArtifacts } from "@repo/backend/convex/contentRelease/retention";
import { compactSnapshots } from "@repo/backend/convex/contentRelease/snapshot/cleanup";
import {
  COMPACTION_HEAD_COUNT,
  COMPACTION_ITEM_COUNT,
  COMPACTION_PAGE_BYTES,
  COMPACTION_PAGE_COUNT,
} from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

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

interface RowPage {
  readonly cursor: null | string;
  readonly deleted: number;
  readonly done: boolean;
}

/** Deletes one content version while retaining the exact floor anchor. */
const compactHead = Effect.fn("contentRelease.compactHead")(function* (
  ctx: MutationCtx,
  row: Doc<"contentHeads">,
  from: number,
  floor: number
) {
  const anchor = yield* loadVersion(ctx, row.contentKey, row.locale, floor);
  if (!anchor) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content ${row.contentKey}/${row.locale} lost its compaction anchor.`
    );
  }
  let deleted = 0;
  const artifacts = new Set<string>();
  if (anchor._id !== row._id) {
    yield* Effect.promise(() => ctx.db.delete("contentHeads", row._id));
    if (row.artifactHash) {
      artifacts.add(row.artifactHash);
    }
    deleted += 1;
  }
  const prior = yield* loadVersion(
    ctx,
    row.contentKey,
    row.locale,
    row.sequence - 1
  );
  if (prior && prior.sequence < from && prior._id !== anchor._id) {
    yield* Effect.promise(() => ctx.db.delete("contentHeads", prior._id));
    if (prior.artifactHash) {
      artifacts.add(prior.artifactHash);
    }
    deleted += 1;
  }
  yield* retainOrphanedArtifacts(ctx, artifacts);
  return deleted;
});

/** Deletes one route version while retaining the exact floor anchor. */
const compactBinding = Effect.fn("contentRelease.compactBinding")(function* (
  ctx: MutationCtx,
  row: Doc<"contentBindings">,
  from: number,
  floor: number
) {
  const anchor = yield* loadRouteBinding(
    ctx,
    row.locale,
    row.publicPath,
    floor
  );
  if (!anchor) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route ${row.locale}/${row.publicPath} lost its compaction anchor.`
    );
  }
  let deleted = 0;
  if (anchor._id !== row._id) {
    yield* Effect.promise(() => ctx.db.delete("contentBindings", row._id));
    deleted += 1;
  }
  const prior = yield* loadRouteBinding(
    ctx,
    row.locale,
    row.publicPath,
    row.sequence - 1
  );
  if (prior && prior.sequence < from && prior._id !== anchor._id) {
    yield* Effect.promise(() => ctx.db.delete("contentBindings", prior._id));
    deleted += 1;
  }
  return deleted;
});

/** Compacts one bounded immutable content-version page. */
const compactHeads = Effect.fn("contentRelease.compactHeads")(function* (
  ctx: MutationCtx,
  from: number,
  floor: number,
  cursor: null | string
) {
  const page = yield* Effect.promise(() =>
    ctx.db
      .query("contentHeads")
      .withIndex("by_sequence", (query) =>
        query.gte("sequence", from).lte("sequence", floor)
      )
      .paginate({ ...headPage, cursor })
  );
  let deleted = 0;
  for (const row of page.page) {
    deleted += yield* compactHead(ctx, row, from, floor);
  }
  return {
    cursor: page.isDone ? null : page.continueCursor,
    deleted,
    done: page.isDone,
  } satisfies RowPage;
});

/** Compacts one bounded immutable route-version page. */
const compactBindings = Effect.fn("contentRelease.compactBindings")(function* (
  ctx: MutationCtx,
  from: number,
  floor: number,
  cursor: null | string
) {
  const page = yield* Effect.promise(() =>
    ctx.db
      .query("contentBindings")
      .withIndex("by_sequence", (query) =>
        query.gte("sequence", from).lte("sequence", floor)
      )
      .paginate({ ...compactionPage, cursor })
  );
  let deleted = 0;
  for (const row of page.page) {
    deleted += yield* compactBinding(ctx, row, from, floor);
  }
  return {
    cursor: page.isDone ? null : page.continueCursor,
    deleted,
    done: page.isDone,
  } satisfies RowPage;
});

/** Deletes one bounded obsolete release-item page. */
const compactItems = Effect.fn("contentRelease.compactItems")(function* (
  ctx: MutationCtx,
  from: number,
  floor: number,
  cursor: null | string
) {
  const page = yield* Effect.promise(() =>
    ctx.db
      .query("contentItems")
      .withIndex("by_sequence", (query) =>
        query.gte("sequence", from).lt("sequence", floor)
      )
      .paginate({ ...itemPage, cursor })
  );
  for (const row of page.page) {
    yield* Effect.promise(() => ctx.db.delete("contentItems", row._id));
  }
  yield* retainOrphanedArtifacts(
    ctx,
    page.page.flatMap(({ artifactHash }) =>
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
  function* (
    ctx: MutationCtx,
    from: number,
    floor: number,
    cursor: null | string
  ) {
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("snapshotBatches")
        .withIndex("by_sequence_and_family_and_batchIndex", (query) =>
          query.gte("sequence", from).lt("sequence", floor)
        )
        .paginate({ ...compactionPage, cursor })
    );
    for (const row of page.page) {
      yield* Effect.promise(() => ctx.db.delete("snapshotBatches", row._id));
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
  ctx: MutationCtx,
  from: number,
  floor: number,
  cursor: null | string
) {
  const page = yield* Effect.promise(() =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_sequence", (query) =>
        query.gte("sequence", from).lt("sequence", floor)
      )
      .paginate({ ...compactionPage, cursor })
  );
  for (const row of page.page) {
    yield* Effect.promise(() => ctx.db.delete("contentReleases", row._id));
  }
  return {
    cursor: page.isDone ? null : page.continueCursor,
    deleted: page.page.length,
    done: page.isDone,
  } satisfies RowPage;
});

/** Runs one persisted bounded page for the current compaction phase. */
export const compactRows = Effect.fn("contentRelease.compactRows")(function* (
  ctx: MutationCtx,
  phase: NonNullable<Doc<"contentState">["compactPhase"]>,
  from: number,
  floor: number,
  cursor: null | string,
  startedAt: number
) {
  if (phase === "heads") {
    return yield* compactHeads(ctx, from, floor, cursor);
  }
  if (phase === "bindings") {
    return yield* compactBindings(ctx, from, floor, cursor);
  }
  if (phase === "items") {
    return yield* compactItems(ctx, from, floor, cursor);
  }
  if (phase === "batches") {
    return yield* compactBatches(ctx, from, floor, cursor);
  }
  if (phase === "artifacts") {
    return yield* compactArtifacts(ctx, cursor, startedAt);
  }
  if (phase === "snapshots") {
    return yield* compactSnapshots(ctx, startedAt);
  }
  return yield* compactReleases(ctx, from, floor, cursor);
});
