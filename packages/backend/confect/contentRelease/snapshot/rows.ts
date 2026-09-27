import { DatabaseReader, DatabaseWriter } from "@confect/server";
import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

const CLEANUP_PAGE_COUNT = 2;
const CLEANUP_PAGE_BYTES = CONTENT_DOCUMENT_LIMIT * CLEANUP_PAGE_COUNT;
type CleanupPart = NonNullable<Doc<"contentSnapshots">["cleanupPart"]>;
type SnapshotChild =
  | {
      readonly row: Doc<"programCatalog">;
      readonly table: "programCatalog";
    }
  | {
      readonly row: Doc<"curriculumRoutes">;
      readonly table: "curriculumRoutes";
    }
  | {
      readonly row: Doc<"programBuckets">;
      readonly table: "programBuckets";
    }
  | {
      readonly row: Doc<"quranRows">;
      readonly table: "quranRows";
    }
  | {
      readonly row: Doc<"quranSearch">;
      readonly table: "quranSearch";
    }
  | {
      readonly row: Doc<"tryoutRuntimeBundles">;
      readonly table: "tryoutRuntimeBundles";
    }
  | {
      readonly row: Doc<"tryoutCatalog">;
      readonly table: "tryoutCatalog";
    }
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
  const database = DatabaseReader.make(databaseSchema, ctx.db);
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
      const page = yield* database
        .table("programCatalog")
        .index("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId).gt("index", afterIndex)
        )
        .paginate(cleanupPage())
        .pipe(Effect.orDie);
      return {
        children: page.page.map(
          (row): SnapshotChild => ({
            row,
            table: "programCatalog",
          })
        ),
        done: page.isDone,
        part: selected,
      } satisfies ChildPage;
    }
    if (selected === "curriculum") {
      const page = yield* database
        .table("curriculumRoutes")
        .index("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId).gt("index", afterIndex)
        )
        .paginate(cleanupPage())
        .pipe(Effect.orDie);
      return {
        children: page.page.map(
          (row): SnapshotChild => ({
            row,
            table: "curriculumRoutes",
          })
        ),
        done: page.isDone,
        part: selected,
      } satisfies ChildPage;
    }
    const page = yield* database
      .table("programBuckets")
      .index("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", snapshotId).gt("index", afterIndex)
      )
      .paginate(cleanupPage())
      .pipe(Effect.orDie);
    return {
      children: page.page.map(
        (row): SnapshotChild => ({
          row,
          table: "programBuckets",
        })
      ),
      done: page.isDone,
      part: selected,
    } satisfies ChildPage;
  }
  if (family === "quran") {
    const selected = part ?? "quran";
    if (selected !== "quran" && selected !== "quran-search") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Quran snapshot ${snapshotId} has an invalid cleanup part.`
      );
    }
    if (selected === "quran") {
      const page = yield* database
        .table("quranRows")
        .index("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId).gt("index", afterIndex)
        )
        .paginate(cleanupPage())
        .pipe(Effect.orDie);
      return {
        children: page.page.map(
          (row): SnapshotChild => ({
            row,
            table: "quranRows",
          })
        ),
        done: page.isDone,
        part: selected,
      } satisfies ChildPage;
    }
    const page = yield* database
      .table("quranSearch")
      .index("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", snapshotId).gt("index", afterIndex)
      )
      .paginate(cleanupPage())
      .pipe(Effect.orDie);
    return {
      children: page.page.map(
        (row): SnapshotChild => ({
          row,
          table: "quranSearch",
        })
      ),
      done: page.isDone,
      part: selected,
    } satisfies ChildPage;
  }
  const selected = part ?? "catalog";
  if (selected === "catalog") {
    const page = yield* database
      .table("tryoutCatalog")
      .index("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", snapshotId).gt("index", afterIndex)
      )
      .paginate(cleanupPage())
      .pipe(Effect.orDie);
    return {
      children: page.page.map(
        (row): SnapshotChild => ({
          row,
          table: "tryoutCatalog",
        })
      ),
      done: page.isDone,
      part: selected,
    } satisfies ChildPage;
  }
  if (selected === "placement") {
    const page = yield* database
      .table("tryoutPlacements")
      .index("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", snapshotId).gt("index", afterIndex)
      )
      .paginate(cleanupPage())
      .pipe(Effect.orDie);
    return {
      children: page.page.map(
        (row): SnapshotChild => ({
          row,
          table: "tryoutPlacements",
        })
      ),
      done: page.isDone,
      part: selected,
    } satisfies ChildPage;
  }
  if (selected !== "runtime") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out snapshot ${snapshotId} has an invalid cleanup part.`
    );
  }
  const page = yield* database
    .table("tryoutRuntimeBundles")
    .index("by_snapshotId_and_rendererManifestHash", (query) =>
      query.eq("snapshotId", snapshotId)
    )
    .paginate(cleanupPage())
    .pipe(Effect.orDie);
  return {
    children: page.page.map(
      (row): SnapshotChild => ({
        row,
        table: "tryoutRuntimeBundles",
      })
    ),
    done: page.isDone,
    part: selected,
  } satisfies ChildPage;
});

/** Deletes one child row through its domain-owned physical table. */
export const deleteSnapshotChild = Effect.fn(
  "contentRelease.deleteSnapshotChild"
)(function* (ctx: MutationCtx, child: SnapshotChild) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  if (child.table === "programCatalog") {
    yield* writer.table("programCatalog").delete(child.row._id);
    return;
  }
  if (child.table === "curriculumRoutes") {
    yield* writer.table("curriculumRoutes").delete(child.row._id);
    return;
  }
  if (child.table === "programBuckets") {
    yield* writer.table("programBuckets").delete(child.row._id);
    return;
  }
  if (child.table === "quranRows") {
    yield* writer.table("quranRows").delete(child.row._id);
    return;
  }
  if (child.table === "quranSearch") {
    yield* writer.table("quranSearch").delete(child.row._id);
    return;
  }
  if (child.table === "tryoutCatalog") {
    yield* writer.table("tryoutCatalog").delete(child.row._id);
    return;
  }
  if (child.table === "tryoutRuntimeBundles") {
    yield* writer.table("tryoutRuntimeBundles").delete(child.row._id);
    return;
  }
  yield* writer.table("tryoutPlacements").delete(child.row._id);
});
