import { DatabaseReader } from "@confect/server";
import type { ContentSnapshotManifest } from "@nakafa/aksara-contracts/release/snapshot/data";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/confect/contentRelease/snapshot/manifest";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";
export interface StoredRow {
  readonly index: number;
  readonly rowJson: string;
}
export type SnapshotFamily = ContentSnapshotManifest["family"];

/** Proves one stored page is complete and returns canonical row bytes. */
export const exactRowJson = Effect.fn("contentRelease.exactSnapshotRowJson")(
  function* (
    rows: readonly StoredRow[],
    family: SnapshotFamily,
    snapshotId: string,
    firstIndex: number,
    rowCount: number
  ) {
    if (
      rows.length !== rowCount ||
      rows.some((row, offset) => row.index !== firstIndex + offset)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Snapshot ${family}/${snapshotId} lost one staged row range.`
      );
    }
    return rows.map(({ rowJson }) => rowJson);
  }
);

/** Reads exact row JSON for one immutable family batch. */
export const loadRows = Effect.fn("contentRelease.loadSnapshotRows")(function* (
  ctx: QueryCtx,
  family: SnapshotFamily,
  snapshotId: string,
  firstIndex: number,
  rowCount: number
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  if (family === "program") {
    const [catalog, curriculum] = yield* Effect.all([
      database
        .table("programCatalog")
        .index("by_snapshotId_and_index", (range) =>
          range
            .eq("snapshotId", snapshotId)
            .gte("index", firstIndex)
            .lte("index", firstIndex + rowCount - 1)
        )
        .take(rowCount + 1)
        .pipe(Effect.orDie),
      database
        .table("curriculumRoutes")
        .index("by_snapshotId_and_index", (range) =>
          range
            .eq("snapshotId", snapshotId)
            .gte("index", firstIndex)
            .lte("index", firstIndex + rowCount - 1)
        )
        .take(rowCount + 1)
        .pipe(Effect.orDie),
    ]);
    const rows = [...catalog, ...curriculum].sort(
      (left, right) => left.index - right.index
    );
    return yield* exactRowJson(rows, family, snapshotId, firstIndex, rowCount);
  }
  if (family === "quran") {
    const rows = yield* database
      .table("quranRows")
      .index("by_snapshotId_and_index", (range) =>
        range
          .eq("snapshotId", snapshotId)
          .gte("index", firstIndex)
          .lte("index", firstIndex + rowCount - 1)
      )
      .take(rowCount + 1)
      .pipe(Effect.orDie);
    return yield* exactRowJson(rows, family, snapshotId, firstIndex, rowCount);
  }
  const [catalog, placements] = yield* Effect.all([
    database
      .table("tryoutCatalog")
      .index("by_snapshotId_and_index", (range) =>
        range
          .eq("snapshotId", snapshotId)
          .gte("index", firstIndex)
          .lte("index", firstIndex + rowCount - 1)
      )
      .take(rowCount + 1)
      .pipe(Effect.orDie),
    database
      .table("tryoutPlacements")
      .index("by_snapshotId_and_index", (range) =>
        range
          .eq("snapshotId", snapshotId)
          .gte("index", firstIndex)
          .lte("index", firstIndex + rowCount - 1)
      )
      .take(rowCount + 1)
      .pipe(Effect.orDie),
  ]);
  const rows = [...catalog, ...placements].sort(
    (left, right) => left.index - right.index
  );
  return yield* exactRowJson(rows, family, snapshotId, firstIndex, rowCount);
});

/** Reads one exact family manifest selected by the staged release. */
export const manifestProgram = Effect.fn("contentRelease.readSnapshotManifest")(
  function* (ctx: QueryCtx, releaseId: string, family: SnapshotFamily) {
    const release = yield* loadRelease(ctx, releaseId);
    const signed = yield* decodeReleaseJson(release.releaseJson);
    const state = signed.manifest.snapshots[family];
    if (state.mode !== "replace" || state.resultSnapshotId === null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Release ${releaseId} does not replace ${family}.`
      );
    }
    const snapshot = yield* loadSnapshot(ctx, family, state.resultSnapshotId);
    if (!snapshot) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Release ${releaseId} lost its ${family} manifest.`
      );
    }
    return snapshot.snapshotJson;
  }
);

/** Reads one exact contiguous release-owned snapshot batch. */
export const rowPageProgram = Effect.fn("contentRelease.readSnapshotBatch")(
  function* (
    ctx: QueryCtx,
    releaseId: string,
    family: SnapshotFamily,
    afterBatchIndex: number
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const release = yield* loadRelease(ctx, releaseId);
    const signed = yield* decodeReleaseJson(release.releaseJson);
    const state = signed.manifest.snapshots[family];
    if (state.mode !== "replace" || state.resultSnapshotId === null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Release ${releaseId} does not own ${family} snapshot rows.`
      );
    }
    let expectedFirstIndex = 0;
    if (afterBatchIndex >= 0) {
      const previousRows = yield* database
        .table("snapshotBatches")
        .index("by_releaseId_and_family_and_batchIndex", (query) =>
          query
            .eq("releaseId", releaseId)
            .eq("family", family)
            .eq("batchIndex", afterBatchIndex)
        )
        .take(2)
        .pipe(Effect.orDie);
      const [previous] = previousRows;
      if (
        !previous ||
        previousRows.length !== 1 ||
        previous.snapshotId !== state.resultSnapshotId
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Release ${releaseId} lost its ${family} snapshot cursor.`
        );
      }
      expectedFirstIndex = previous.firstIndex + previous.rowCount;
    }
    const [batch, next] = yield* database
      .table("snapshotBatches")
      .index("by_releaseId_and_family_and_batchIndex", (query) =>
        query
          .eq("releaseId", releaseId)
          .eq("family", family)
          .gt("batchIndex", afterBatchIndex)
      )
      .take(2)
      .pipe(Effect.orDie);
    if (!batch) {
      if (expectedFirstIndex !== state.rowCount) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Release ${releaseId} lost its terminal ${family} snapshot batch.`
        );
      }
      return {
        batchIndex: afterBatchIndex,
        done: true,
        firstIndex: state.rowCount,
        nextBatchIndex: afterBatchIndex,
        rowJson: [],
        snapshotId: state.resultSnapshotId,
      };
    }
    const expectedBatch = afterBatchIndex + 1;
    if (
      batch.batchIndex !== expectedBatch ||
      batch.snapshotId !== state.resultSnapshotId ||
      batch.firstIndex !== expectedFirstIndex ||
      batch.firstIndex + batch.rowCount > state.rowCount
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Release ${releaseId} has a non-contiguous ${family} snapshot ledger.`
      );
    }
    if (
      next
        ? next.batchIndex !== batch.batchIndex + 1 ||
          next.firstIndex !== batch.firstIndex + batch.rowCount
        : batch.firstIndex + batch.rowCount !== state.rowCount
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Release ${releaseId} has an incomplete ${family} snapshot ledger.`
      );
    }
    const rowJson = yield* loadRows(
      ctx,
      family,
      batch.snapshotId,
      batch.firstIndex,
      batch.rowCount
    );
    return {
      batchIndex: batch.batchIndex,
      done: next === undefined,
      firstIndex: batch.firstIndex,
      nextBatchIndex: batch.batchIndex,
      rowJson,
      snapshotId: batch.snapshotId,
    };
  }
);
