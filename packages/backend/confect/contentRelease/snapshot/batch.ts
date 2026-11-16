import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { validateStoredBatch } from "@repo/backend/confect/contentRelease/batch";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadStaged } from "@repo/backend/confect/contentRelease/model";
import { stageAssessmentRow } from "@repo/backend/confect/contentRelease/snapshot/assessment";
import type { stageBatchArgsValidator } from "@repo/backend/confect/contentRelease/snapshot/batch.spec";
import { loadSnapshot } from "@repo/backend/confect/contentRelease/snapshot/manifest";
import {
  stageCurriculum,
  stageProgram,
} from "@repo/backend/confect/contentRelease/snapshot/program";
import { stageQuranRow } from "@repo/backend/confect/contentRelease/snapshot/quran";
import type { PreparedRowSchema } from "@repo/backend/confect/contentRelease/snapshot/shape";
import { Array as Arr, Clock, Effect } from "effect";

/** Stores one prepared row in its domain-owned physical table. */
export function stageRow(
  snapshotId: string,
  index: number,
  row: typeof PreparedRowSchema.Type
) {
  if (row.kind === "program") {
    return stageProgram(snapshotId, index, row.document);
  }
  if (row.kind === "curriculum") {
    return stageCurriculum(snapshotId, index, row.document);
  }
  if (row.kind === "quran") {
    return stageQuranRow(snapshotId, index, row.document, row.search);
  }
  return stageAssessmentRow(snapshotId, index, row.document);
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
const nextRowIndex = Effect.fn("contentRelease.nextSnapshotRowIndex")(
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

/**
 * Stages one prepared snapshot batch with byte-identical retry semantics. The
 * ingress action already decoded, hashed, derived and sized every row, and
 * read the row counts from the signed manifest whose hash this checks, so this
 * transaction only reads the ledger and the row indexes, and inserts.
 */
export const stageBatch = Effect.fn("contentRelease.stageSnapshotBatch")(
  function* (args: typeof stageBatchArgsValidator.Type) {
    const { batchHash, batchIndex, family, releaseId, rows, snapshotId } = args;
    const writer = yield* DatabaseWriter;
    const { release } = yield* loadStaged(releaseId);
    if (
      release.status !== "staging" ||
      release.abortingAt !== undefined ||
      release.manifestHash !== args.manifestHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Release ${releaseId} does not accept ${family} snapshot rows.`
      );
    }
    if (!(yield* loadSnapshot(family, snapshotId))) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Snapshot ${family}/${snapshotId} must be staged before its rows.`
      );
    }
    const existing = yield* loadBatch(releaseId, family, batchIndex);
    if (existing) {
      yield* validateStoredBatch(
        existing.rowCount,
        rows.length,
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
        unchanged: rows.length,
      };
    }
    const firstIndex = yield* nextRowIndex(releaseId, family, batchIndex);
    if (
      firstIndex + rows.length > args.familyRows ||
      release.stagedSnapshotRows + rows.length > args.totalRows
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Snapshot batch ${family}/${batchIndex} exceeds signed row counts.`
      );
    }
    const unchangedRows = yield* Effect.forEach(rows, (row, offset) =>
      stageRow(snapshotId, firstIndex + offset, row)
    );
    const unchanged = Arr.filter(
      unchangedRows,
      (isUnchanged) => isUnchanged
    ).length;
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
        rowCount: rows.length,
        sequence: release.sequence,
        snapshotId,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("contentReleases")
      .patch(release._id, {
        stagedSnapshotBatches: release.stagedSnapshotBatches + 1,
        stagedSnapshotRows: release.stagedSnapshotRows + rows.length,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    return {
      batchIndex,
      created: rows.length - unchanged,
      family,
      releaseId,
      snapshotId,
      unchanged,
    };
  }
);
