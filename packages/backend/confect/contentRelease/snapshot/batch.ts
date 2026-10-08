import {
  type ContentSnapshotRow,
  contentSnapshotId,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { snapshotRowCount } from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  hashBatch,
  validateStoredBatch,
} from "@repo/backend/confect/contentRelease/batch";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadStaged } from "@repo/backend/confect/contentRelease/model";
import {
  decodeReleaseJson,
  decodeSnapshotJson,
} from "@repo/backend/confect/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/confect/contentRelease/snapshot/manifest";
import { stageProgramRow } from "@repo/backend/confect/contentRelease/snapshot/program";
import { stageQuranRow } from "@repo/backend/confect/contentRelease/snapshot/quran";
import { decodeSnapshotBatch } from "@repo/backend/confect/contentRelease/snapshot/request";
import {
  stageTryoutCatalog,
  stageTryoutPlacement,
} from "@repo/backend/confect/contentRelease/snapshot/tryout";
import { encodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/wire";
import { Array as Arr, Clock, Effect } from "effect";

/** Stores one decoded family row in its domain-owned physical table. */
export function stageRow(
  snapshotId: string,
  index: number,
  row: ContentSnapshotRow,
  rowJson: string
) {
  if (row.family === "program") {
    return stageProgramRow(snapshotId, index, row, rowJson);
  }
  if (row.family === "quran") {
    return stageQuranRow(snapshotId, index, row, rowJson);
  }
  return row.rowKind === "catalog"
    ? stageTryoutCatalog(snapshotId, index, row, rowJson)
    : stageTryoutPlacement(snapshotId, index, row, rowJson);
}

/** Rejects ambiguous ledger identity before accepting a retry or continuation. */
const loadBatch = Effect.fn("contentRelease.loadSnapshotBatch")(function* (
  releaseId: string,
  family: ContentSnapshotKind,
  batchIndex: number
) {
  const rows = yield* (yield* DatabaseReader)
    .table("snapshotBatches")
    .index("by_releaseId_and_family_and_batchIndex", (q) =>
      q
        .eq("releaseId", releaseId)
        .eq("family", family)
        .eq("batchIndex", batchIndex)
    )
    .take(2)
    .pipe(Effect.orDie);
  if (rows.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Snapshot batch ${family}/${batchIndex} has duplicate ledger rows.`
    );
  }
  return rows[0];
});

/** Resolves the next exact family-local row index from the prior batch. */
export const nextRowIndex = Effect.fn("contentRelease.nextSnapshotRowIndex")(
  function* (
    releaseId: string,
    family: ContentSnapshotKind,
    batchIndex: number
  ) {
    if (batchIndex === 0) {
      return 0;
    }
    const previous = yield* loadBatch(releaseId, family, batchIndex - 1);
    if (!previous) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Snapshot batch ${family}/${batchIndex} is not contiguous.`
      );
    }
    return previous.firstIndex + previous.rowCount;
  }
);

/** Stages one canonical snapshot batch with byte-identical retry semantics. */
export const stageBatch = Effect.fn("contentRelease.stageSnapshotBatch")(
  function* (
    releaseId: string,
    family: ContentSnapshotKind,
    snapshotId: string,
    batchIndex: number,
    sources: readonly string[]
  ) {
    const writer = yield* DatabaseWriter;
    const decoded = yield* decodeSnapshotBatch(
      releaseId,
      family,
      snapshotId,
      batchIndex,
      sources
    );
    const entries = Arr.map(decoded.rows, (row) => ({
      row,
      rowJson: encodeSnapshotRowJson(row),
    }));
    const values = Arr.map(entries, ({ rowJson }) => rowJson);
    const batchHash = yield* hashBatch("snapshot", releaseId, batchIndex, [
      family,
      snapshotId,
      ...values,
    ]);
    const { release } = yield* loadStaged(releaseId);
    const signed = yield* decodeReleaseJson(release.releaseJson);
    const state = signed.manifest.snapshots[family];
    if (
      release.status !== "staging" ||
      release.abortingAt !== undefined ||
      state.mode !== "replace" ||
      state.resultSnapshotId !== snapshotId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Release ${releaseId} does not accept ${family} snapshot rows.`
      );
    }
    const storedManifest = yield* loadSnapshot(family, snapshotId);
    if (!storedManifest) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Snapshot ${family}/${snapshotId} must be staged before its rows.`
      );
    }
    const manifest = yield* decodeSnapshotJson(storedManifest.snapshotJson);
    if (
      contentSnapshotId(manifest) !== snapshotId ||
      manifest.family !== family
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Snapshot ${family}/${snapshotId} lost its manifest identity.`
      );
    }
    const existing = yield* loadBatch(releaseId, family, batchIndex);
    if (existing) {
      yield* validateStoredBatch(
        existing.rowCount,
        values.length,
        [existing.batchHash],
        batchHash,
        releaseId,
        batchIndex
      );
      if (existing.snapshotId !== snapshotId) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Snapshot batch ${family}/${batchIndex} changed snapshot identity.`
        );
      }
      return {
        batchIndex,
        created: 0,
        family,
        releaseId,
        snapshotId,
        unchanged: values.length,
      };
    }
    const firstIndex = yield* nextRowIndex(releaseId, family, batchIndex);
    if (
      firstIndex + values.length > state.rowCount ||
      release.stagedSnapshotRows + values.length >
        snapshotRowCount(signed.manifest.snapshots)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Snapshot batch ${family}/${batchIndex} exceeds signed row counts.`
      );
    }
    let unchanged = 0;
    for (const [offset, entry] of entries.entries()) {
      if (
        yield* stageRow(
          snapshotId,
          firstIndex + offset,
          entry.row,
          entry.rowJson
        )
      ) {
        unchanged += 1;
      }
    }
    const now = yield* Clock.currentTimeMillis;
    yield* writer
      .table("snapshotBatches")
      .insert({
        batchHash,
        batchIndex,
        createdAt: now,
        family,
        firstIndex,
        releaseId,
        rowCount: values.length,
        sequence: release.sequence,
        snapshotId,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("contentReleases")
      .patch(release._id, {
        stagedSnapshotBatches: release.stagedSnapshotBatches + 1,
        stagedSnapshotRows: release.stagedSnapshotRows + values.length,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    return {
      batchIndex,
      created: values.length - unchanged,
      family,
      releaseId,
      snapshotId,
      unchanged,
    };
  }
);
