import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { isSnapshotReferenced } from "@repo/backend/convex/contentRelease/snapshot/retention";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

const CLEANUP_PAGE_COUNT = 2;
const CLEANUP_PAGE_BYTES = CONTENT_DOCUMENT_LIMIT * CLEANUP_PAGE_COUNT;

type CleanupPart = NonNullable<Doc<"contentSnapshots">["cleanupPart"]>;
type SnapshotChild =
  | { readonly row: Doc<"programRows">; readonly table: "programRows" }
  | { readonly row: Doc<"quranRows">; readonly table: "quranRows" }
  | { readonly row: Doc<"tryoutCatalog">; readonly table: "tryoutCatalog" }
  | {
      readonly row: Doc<"tryoutPlacements">;
      readonly table: "tryoutPlacements";
    };

interface ChildPage {
  readonly children: readonly SnapshotChild[];
  readonly done: boolean;
  readonly part?: CleanupPart;
}

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

/** Native page controls shared by every body-bearing cleanup query. */
function cleanupPage() {
  return {
    cursor: null,
    maximumBytesRead: CLEANUP_PAGE_BYTES,
    maximumRowsRead: CLEANUP_PAGE_COUNT,
    numItems: CLEANUP_PAGE_COUNT,
  };
}

/** Reads one row- and byte-bounded physical snapshot page. */
const loadChildren = Effect.fn("contentRelease.loadSnapshotChildren")(
  function* (
    ctx: MutationCtx,
    family: ContentSnapshotKind,
    snapshotId: string,
    afterIndex: number,
    part?: CleanupPart
  ) {
    if (family === "program") {
      if (part !== undefined) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Program snapshot ${snapshotId} has a try-out cleanup part.`
        );
      }
      const page = yield* Effect.promise(() =>
        ctx.db
          .query("programRows")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).gt("index", afterIndex)
          )
          .paginate(cleanupPage())
      );
      return {
        children: page.page.map(
          (row): SnapshotChild => ({ row, table: "programRows" })
        ),
        done: page.isDone,
      } satisfies ChildPage;
    }
    if (family === "quran") {
      if (part !== undefined) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Quran snapshot ${snapshotId} has a try-out cleanup part.`
        );
      }
      const page = yield* Effect.promise(() =>
        ctx.db
          .query("quranRows")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).gt("index", afterIndex)
          )
          .paginate(cleanupPage())
      );
      return {
        children: page.page.map(
          (row): SnapshotChild => ({ row, table: "quranRows" })
        ),
        done: page.isDone,
      } satisfies ChildPage;
    }
    const selected = part ?? "catalog";
    if (selected === "catalog") {
      const page = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutCatalog")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).gt("index", afterIndex)
          )
          .paginate(cleanupPage())
      );
      return {
        children: page.page.map(
          (row): SnapshotChild => ({ row, table: "tryoutCatalog" })
        ),
        done: page.isDone,
        part: selected,
      } satisfies ChildPage;
    }
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId).gt("index", afterIndex)
        )
        .paginate(cleanupPage())
    );
    return {
      children: page.page.map(
        (row): SnapshotChild => ({ row, table: "tryoutPlacements" })
      ),
      done: page.isDone,
      part: selected,
    } satisfies ChildPage;
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

/** Persists one incomplete physical cleanup page. */
const persistCleanup = Effect.fn("contentRelease.persistSnapshotCleanup")(
  function* (
    ctx: MutationCtx,
    snapshot: Doc<"contentSnapshots">,
    cutoff: number,
    cleanupIndex: number | undefined,
    cleanupPart: CleanupPart | undefined
  ) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentSnapshots", snapshot._id, {
        cleanupAt: snapshot.cleanupAt ?? cutoff,
        cleanupIndex,
        cleanupPart,
        cleanupRetryAt: cutoff,
      })
    );
  }
);

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
    const children = yield* loadChildren(
      ctx,
      snapshot.family,
      snapshot.snapshotId,
      snapshot.cleanupIndex ?? -1,
      snapshot.cleanupPart
    );
    for (const child of children.children) {
      yield* deleteChild(ctx, child);
    }
    if (!children.done) {
      const last = children.children.at(-1);
      if (!last) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Snapshot ${snapshot.family}/${snapshot.snapshotId} lost its cleanup page.`
        );
      }
      yield* persistCleanup(
        ctx,
        snapshot,
        cutoff,
        last.row.index,
        children.part
      );
      return {
        cursor: null,
        deleted: children.children.length,
        done: false,
      };
    }
    if (snapshot.family === "tryout" && children.part === "catalog") {
      yield* persistCleanup(ctx, snapshot, cutoff, undefined, "placement");
      return {
        cursor: null,
        deleted: children.children.length,
        done: false,
      };
    }
    yield* Effect.promise(() =>
      ctx.db.delete("contentSnapshots", snapshot._id)
    );
    return {
      cursor: null,
      deleted: children.children.length + 1,
      done: false,
    };
  }
);
