import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

const CLEANUP_PAGE_COUNT = 2;
const CLEANUP_PAGE_BYTES = CONTENT_DOCUMENT_LIMIT * CLEANUP_PAGE_COUNT;

type CleanupPart = NonNullable<Doc<"contentSnapshots">["cleanupPart"]>;
type SnapshotChild =
  | { readonly row: Doc<"programCatalog">; readonly table: "programCatalog" }
  | {
      readonly row: Doc<"curriculumRoutes">;
      readonly table: "curriculumRoutes";
    }
  | { readonly row: Doc<"programBuckets">; readonly table: "programBuckets" }
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
export const loadSnapshotChildren = Effect.fn(
  "contentRelease.loadSnapshotChildren"
)(function* (
  ctx: MutationCtx,
  family: ContentSnapshotKind,
  snapshotId: string,
  afterIndex: number,
  part?: CleanupPart
) {
  if (family === "program") {
    const selected = part ?? "program";
    if (
      selected !== "program" &&
      selected !== "curriculum" &&
      selected !== "bucket"
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Program snapshot ${snapshotId} has an invalid cleanup part.`
      );
    }
    if (selected === "program") {
      const page = yield* Effect.promise(() =>
        ctx.db
          .query("programCatalog")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).gt("index", afterIndex)
          )
          .paginate(cleanupPage())
      );
      return {
        children: page.page.map(
          (row): SnapshotChild => ({ row, table: "programCatalog" })
        ),
        done: page.isDone,
        part: selected,
      } satisfies ChildPage;
    }
    if (selected === "curriculum") {
      const page = yield* Effect.promise(() =>
        ctx.db
          .query("curriculumRoutes")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).gt("index", afterIndex)
          )
          .paginate(cleanupPage())
      );
      return {
        children: page.page.map(
          (row): SnapshotChild => ({ row, table: "curriculumRoutes" })
        ),
        done: page.isDone,
        part: selected,
      } satisfies ChildPage;
    }
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("programBuckets")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId).gt("index", afterIndex)
        )
        .paginate(cleanupPage())
    );
    return {
      children: page.page.map(
        (row): SnapshotChild => ({ row, table: "programBuckets" })
      ),
      done: page.isDone,
      part: selected,
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
});

/** Deletes one child row through its domain-owned physical table. */
export const deleteSnapshotChild = Effect.fn(
  "contentRelease.deleteSnapshotChild"
)(function* (ctx: MutationCtx, child: SnapshotChild) {
  if (child.table === "programCatalog") {
    yield* Effect.promise(() => ctx.db.delete("programCatalog", child.row._id));
    return;
  }
  if (child.table === "curriculumRoutes") {
    yield* Effect.promise(() =>
      ctx.db.delete("curriculumRoutes", child.row._id)
    );
    return;
  }
  if (child.table === "programBuckets") {
    yield* Effect.promise(() => ctx.db.delete("programBuckets", child.row._id));
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
