import type { ContentSnapshotManifest } from "@nakafa/aksara-contracts/release/snapshot/data";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/confect/contentRelease/snapshot/manifest";
import { Array as Arr, Effect, Order, Schema } from "effect";

const StoredRowSchema = Schema.Struct({
  index: Schema.Finite,
  rowJson: Schema.String,
});
type StoredRow = typeof StoredRowSchema.Type;
type SnapshotFamily = ContentSnapshotManifest["family"];

/** Proves one stored page is complete and returns canonical row bytes. */
const exactRowJson = Effect.fn("contentRelease.exactSnapshotRowJson")(
  function* (
    rows: readonly StoredRow[],
    family: SnapshotFamily,
    snapshotId: string,
    firstIndex: number,
    rowCount: number
  ) {
    if (
      rows.length !== rowCount ||
      Arr.some(rows, (row, offset) => row.index !== firstIndex + offset)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Snapshot ${family}/${snapshotId} lost one staged row range.`
      );
    }
    return Arr.map(rows, ({ rowJson }) => rowJson);
  }
);

/** Reads exact row JSON for one immutable family batch. */
const loadRows = Effect.fn("contentRelease.loadSnapshotRows")(function* (
  family: SnapshotFamily,
  snapshotId: string,
  firstIndex: number,
  rowCount: number
) {
  const database = yield* DatabaseReader;
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
    const rows = Arr.sortWith(
      [...catalog, ...curriculum],
      (left) => left.index,
      Order.Number
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
  const rows = yield* database
    .table("assessmentRows")
    .index("by_snapshotId_and_index", (range) =>
      range
        .eq("snapshotId", snapshotId)
        .gte("index", firstIndex)
        .lte("index", firstIndex + rowCount - 1)
    )
    .take(rowCount + 1)
    .pipe(Effect.orDie);
  return yield* exactRowJson(rows, family, snapshotId, firstIndex, rowCount);
});

/** Reads one exact family manifest selected by the staged release. */
export const manifestProgram = Effect.fn("contentRelease.readSnapshotManifest")(
  function* (releaseId: string, family: SnapshotFamily) {
    const release = yield* loadRelease(releaseId);
    const signed = yield* decodeReleaseJson(release.releaseJson);
    const state = signed.manifest.snapshots[family];
    if (state.mode !== "replace" || state.resultSnapshotId === null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Release ${releaseId} does not replace ${family}.`
      );
    }
    const snapshot = yield* loadSnapshot(family, state.resultSnapshotId);
    if (!snapshot) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Release ${releaseId} lost its ${family} manifest.`
      );
    }
    return snapshot.snapshotJson;
  }
);

/** Total UTF-16 length of row JSON, the budget a run of batches spends. */
function runBytes(rowJson: readonly string[]) {
  return Arr.reduce(rowJson, 0, (total, row) => total + row.length);
}

/**
 * Reads a run of contiguous release-owned snapshot batches after a cursor: at
 * least one batch, then more while the run stays under `maxBatches` batches and
 * `maxBytes` of row JSON. Every batch passes the same ledger checks a single
 * batch did, so a run is exactly the rows of its batches in canonical order.
 */
export const rowPageProgram = Effect.fn("contentRelease.readSnapshotBatch")(
  function* (
    releaseId: string,
    family: SnapshotFamily,
    afterBatchIndex: number,
    maxBatches: number,
    maxBytes: number
  ) {
    const database = yield* DatabaseReader;
    const release = yield* loadRelease(releaseId);
    const signed = yield* decodeReleaseJson(release.releaseJson);
    const state = signed.manifest.snapshots[family];
    if (state.mode !== "replace" || state.resultSnapshotId === null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Release ${releaseId} does not own ${family} snapshot rows.`
      );
    }
    const snapshotId = state.resultSnapshotId;
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
        previous.snapshotId !== snapshotId
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Release ${releaseId} lost its ${family} snapshot cursor.`
        );
      }
      expectedFirstIndex = previous.firstIndex + previous.rowCount;
    }
    /** The batch after `index` and the one after that, as the ledger stores them. */
    const following = (index: number) =>
      database
        .table("snapshotBatches")
        .index("by_releaseId_and_family_and_batchIndex", (query) =>
          query
            .eq("releaseId", releaseId)
            .eq("family", family)
            .gt("batchIndex", index)
        )
        .take(2)
        .pipe(Effect.orDie);
    /** Proves one batch continues the run and returns its exact rows. */
    const readBatch = Effect.fnUntraced(function* (
      batch: Docs["snapshotBatches"],
      next: Docs["snapshotBatches"] | undefined,
      expectedBatch: number,
      firstIndex: number
    ) {
      if (
        batch.batchIndex !== expectedBatch ||
        batch.snapshotId !== snapshotId ||
        batch.firstIndex !== firstIndex ||
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
      return yield* loadRows(
        family,
        batch.snapshotId,
        batch.firstIndex,
        batch.rowCount
      );
    });
    const [batch, next] = yield* following(afterBatchIndex);
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
        snapshotId,
      };
    }
    let rowJson = yield* readBatch(
      batch,
      next,
      afterBatchIndex + 1,
      expectedFirstIndex
    );
    let last = batch;
    let upcoming = next;
    let batches = 1;
    while (upcoming && batches < maxBatches && runBytes(rowJson) < maxBytes) {
      const current = upcoming;
      const [, after] = yield* following(last.batchIndex);
      const rows = yield* readBatch(
        current,
        after,
        last.batchIndex + 1,
        last.firstIndex + last.rowCount
      );
      rowJson = Arr.appendAll(rowJson, rows);
      last = current;
      upcoming = after;
      batches += 1;
    }
    return {
      batchIndex: batch.batchIndex,
      done: upcoming === undefined,
      firstIndex: batch.firstIndex,
      nextBatchIndex: last.batchIndex,
      rowJson,
      snapshotId,
    };
  }
);
