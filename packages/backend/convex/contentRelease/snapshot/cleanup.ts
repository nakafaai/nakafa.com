import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { isSnapshotReferenced } from "@repo/backend/convex/contentRelease/snapshot/retention";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

const CLEANUP_PAGE_COUNT = 32;

type SnapshotChild =
  | { readonly row: Doc<"programRows">; readonly table: "programRows" }
  | { readonly row: Doc<"quranRows">; readonly table: "quranRows" }
  | { readonly row: Doc<"tryoutCatalog">; readonly table: "tryoutCatalog" }
  | {
      readonly row: Doc<"tryoutPlacements">;
      readonly table: "tryoutPlacements";
    };

/** Reads one resumable or newly expired immutable snapshot. */
const loadExpiredSnapshot = Effect.fn("contentRelease.loadExpiredSnapshot")(
  function* (ctx: MutationCtx, cutoff: number) {
    const retry = yield* Effect.promise(() =>
      ctx.db
        .query("contentSnapshots")
        .withIndex("by_cleanupRetryAt_and_family_and_snapshotId", (query) =>
          query.gt("cleanupRetryAt", undefined).lte("cleanupRetryAt", cutoff)
        )
        .first()
    );
    if (retry) {
      return retry;
    }
    return yield* Effect.promise(() =>
      ctx.db
        .query("contentSnapshots")
        .withIndex("by_retainUntil_and_family_and_snapshotId", (query) =>
          query.lte("retainUntil", cutoff)
        )
        .first()
    );
  }
);

/** Reads one bounded globally ordered child-row page. */
const loadChildren = Effect.fn("contentRelease.loadSnapshotChildren")(
  function* (
    ctx: MutationCtx,
    family: ContentSnapshotKind,
    snapshotId: string,
    afterIndex: number
  ) {
    if (family === "program") {
      const rows = yield* Effect.promise(() =>
        ctx.db
          .query("programRows")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).gt("index", afterIndex)
          )
          .take(CLEANUP_PAGE_COUNT + 1)
      );
      return rows.map((row): SnapshotChild => ({ row, table: "programRows" }));
    }
    if (family === "quran") {
      const rows = yield* Effect.promise(() =>
        ctx.db
          .query("quranRows")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).gt("index", afterIndex)
          )
          .take(CLEANUP_PAGE_COUNT + 1)
      );
      return rows.map((row): SnapshotChild => ({ row, table: "quranRows" }));
    }
    const [catalog, placements] = yield* Effect.all([
      Effect.promise(() =>
        ctx.db
          .query("tryoutCatalog")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).gt("index", afterIndex)
          )
          .take(CLEANUP_PAGE_COUNT + 1)
      ),
      Effect.promise(() =>
        ctx.db
          .query("tryoutPlacements")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).gt("index", afterIndex)
          )
          .take(CLEANUP_PAGE_COUNT + 1)
      ),
    ]);
    return [
      ...catalog.map((row): SnapshotChild => ({ row, table: "tryoutCatalog" })),
      ...placements.map(
        (row): SnapshotChild => ({ row, table: "tryoutPlacements" })
      ),
    ].sort((left, right) => left.row.index - right.row.index);
  }
);

/** Deletes one child row through its domain-owned physical table. */
const deleteChild = Effect.fn("contentRelease.deleteSnapshotChild")(function* (
  ctx: MutationCtx,
  child: SnapshotChild
) {
  if (child.table === "programRows") {
    yield* Effect.promise(() => ctx.db.delete("programRows", child.row._id));
    return;
  }
  if (child.table === "quranRows") {
    yield* Effect.promise(() => ctx.db.delete("quranRows", child.row._id));
    return;
  }
  if (child.table === "tryoutCatalog") {
    yield* Effect.promise(() => ctx.db.delete("tryoutCatalog", child.row._id));
    return;
  }
  yield* Effect.promise(() => ctx.db.delete("tryoutPlacements", child.row._id));
});

/** Deletes one bounded snapshot page without exposing partial data. */
export const compactSnapshots = Effect.fn("contentRelease.compactSnapshots")(
  function* (ctx: MutationCtx, cutoff: number) {
    const snapshot = yield* loadExpiredSnapshot(ctx, cutoff);
    if (!snapshot) {
      return { cursor: null, deleted: 0, done: true };
    }
    const referenced = yield* isSnapshotReferenced(
      ctx,
      snapshot.family,
      snapshot.snapshotId
    );
    if (referenced) {
      if (snapshot.cleanupAt !== undefined) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Snapshot ${snapshot.family}/${snapshot.snapshotId} became referenced during cleanup.`
        );
      }
      yield* Effect.promise(() =>
        ctx.db.patch("contentSnapshots", snapshot._id, {
          retainUntil: cutoff + ROLLBACK_RETENTION_MS,
        })
      );
      return { cursor: null, deleted: 0, done: false };
    }
    const afterIndex = snapshot.cleanupIndex ?? -1;
    const children = yield* loadChildren(
      ctx,
      snapshot.family,
      snapshot.snapshotId,
      afterIndex
    );
    const page = children.slice(0, CLEANUP_PAGE_COUNT);
    for (const child of page) {
      yield* deleteChild(ctx, child);
    }
    if (children.length > CLEANUP_PAGE_COUNT) {
      const last = page.at(-1);
      if (!last) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Snapshot ${snapshot.family}/${snapshot.snapshotId} lost its cleanup page.`
        );
      }
      yield* Effect.promise(() =>
        ctx.db.patch("contentSnapshots", snapshot._id, {
          cleanupAt: snapshot.cleanupAt ?? cutoff,
          cleanupIndex: last.row.index,
          cleanupRetryAt: cutoff,
        })
      );
      return { cursor: null, deleted: page.length, done: false };
    }
    yield* Effect.promise(() =>
      ctx.db.delete("contentSnapshots", snapshot._id)
    );
    return { cursor: null, deleted: page.length + 1, done: false };
  }
);
