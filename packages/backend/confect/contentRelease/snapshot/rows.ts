import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import contentSnapshots from "@repo/backend/confect/_generated/tables/contentSnapshots";
import curriculumRoutes from "@repo/backend/confect/_generated/tables/curriculumRoutes";
import programBuckets from "@repo/backend/confect/_generated/tables/programBuckets";
import programCatalog from "@repo/backend/confect/_generated/tables/programCatalog";
import quranRows from "@repo/backend/confect/_generated/tables/quranRows";
import quranSearch from "@repo/backend/confect/_generated/tables/quranSearch";
import tryoutCatalog from "@repo/backend/confect/_generated/tables/tryoutCatalog";
import tryoutPlacements from "@repo/backend/confect/_generated/tables/tryoutPlacements";
import tryoutRuntimeBundles from "@repo/backend/confect/_generated/tables/tryoutRuntimeBundles";
import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { Array as Arr, Effect, Schema } from "effect";

const CLEANUP_PAGE_COUNT = 2;
const CLEANUP_PAGE_BYTES = CONTENT_DOCUMENT_LIMIT * CLEANUP_PAGE_COUNT;
type CleanupPart = NonNullable<Docs["contentSnapshots"]["cleanupPart"]>;
const SnapshotChildSchema = Schema.Union([
  Schema.Struct({
    row: programCatalog.Doc,
    table: Schema.Literal("programCatalog"),
  }),
  Schema.Struct({
    row: curriculumRoutes.Doc,
    table: Schema.Literal("curriculumRoutes"),
  }),
  Schema.Struct({
    row: programBuckets.Doc,
    table: Schema.Literal("programBuckets"),
  }),
  Schema.Struct({
    row: quranRows.Doc,
    table: Schema.Literal("quranRows"),
  }),
  Schema.Struct({
    row: quranSearch.Doc,
    table: Schema.Literal("quranSearch"),
  }),
  Schema.Struct({
    row: tryoutRuntimeBundles.Doc,
    table: Schema.Literal("tryoutRuntimeBundles"),
  }),
  Schema.Struct({
    row: tryoutCatalog.Doc,
    table: Schema.Literal("tryoutCatalog"),
  }),
  Schema.Struct({
    row: tryoutPlacements.Doc,
    table: Schema.Literal("tryoutPlacements"),
  }),
]);
type SnapshotChild = typeof SnapshotChildSchema.Type;
const ChildPageSchema = Schema.Struct({
  children: Schema.Array(SnapshotChildSchema),
  done: Schema.Boolean,
  part: contentSnapshots.Fields.fields.cleanupPart,
});
type ChildPage = typeof ChildPageSchema.Type;

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
  family: ContentSnapshotKind,
  snapshotId: string,
  afterIndex: number,
  part?: CleanupPart
) {
  const database = yield* DatabaseReader;
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
        children: Arr.map(
          page.page,
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
        children: Arr.map(
          page.page,
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
      children: Arr.map(
        page.page,
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
        children: Arr.map(
          page.page,
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
      children: Arr.map(
        page.page,
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
      children: Arr.map(
        page.page,
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
      children: Arr.map(
        page.page,
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
    children: Arr.map(
      page.page,
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
)(function* (child: SnapshotChild) {
  const writer = yield* DatabaseWriter;
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
