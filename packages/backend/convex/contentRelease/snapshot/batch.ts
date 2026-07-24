import { snapshotRowCount } from "@nakafa/aksara-contracts/release/snapshot";
import {
  type ContentSnapshotRow,
  contentSnapshotId,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import {
  MAX_SNAPSHOT_BATCH_BYTES,
  MAX_SNAPSHOT_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import { StageSnapshotBatchInputSchema } from "@nakafa/aksara-contracts/transport/snapshot";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  hashBatch,
  validateStoredBatch,
} from "@repo/backend/convex/contentRelease/batch";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { loadStaged } from "@repo/backend/convex/contentRelease/model";
import {
  decodeReleaseJson,
  decodeSnapshotJson,
  decodeSnapshotRowJson,
  encodeSnapshotRowJson,
} from "@repo/backend/convex/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/convex/contentRelease/snapshot/manifest";
import { stageProgramRow } from "@repo/backend/convex/contentRelease/snapshot/program";
import { stageQuranRow } from "@repo/backend/convex/contentRelease/snapshot/quran";
import {
  stageTryoutCatalog,
  stageTryoutPlacement,
} from "@repo/backend/convex/contentRelease/snapshot/tryout";
import { snapshotBatchReceiptValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getConvexSize, v } from "convex/values";
import { Effect, Schema } from "effect";

/** Strictly decodes one bounded structured-row request at the mutation seam. */
const decodeBatch = Effect.fn("contentRelease.decodeSnapshotBatch")(function* (
  releaseId: string,
  family: "program" | "quran" | "tryout",
  snapshotId: string,
  batchIndex: number,
  rowJson: readonly string[]
) {
  if (
    rowJson.length === 0 ||
    rowJson.length > MAX_SNAPSHOT_BATCH_COUNT ||
    getConvexSize({
      batchIndex,
      family,
      releaseId,
      rowJson: [...rowJson],
      snapshotId,
    }) > MAX_SNAPSHOT_BATCH_BYTES
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Snapshot batch ${family}/${batchIndex} exceeds its bounded transport contract.`
    );
  }
  const rows = yield* Effect.forEach(rowJson, decodeSnapshotRowJson);
  return yield* Schema.decodeUnknown(StageSnapshotBatchInputSchema)({
    batchIndex,
    family,
    releaseId,
    rows,
    snapshotId,
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Snapshot batch ${family}/${batchIndex} violates its exact contract.`,
        })
    )
  );
});

/** Stores one decoded family row in its domain-owned physical table. */
function stageRow(
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  row: ContentSnapshotRow,
  rowJson: string
) {
  if (row.family === "program") {
    return stageProgramRow(ctx, snapshotId, index, row, rowJson);
  }
  if (row.family === "quran") {
    return stageQuranRow(ctx, snapshotId, index, row, rowJson);
  }
  return row.rowKind === "catalog"
    ? stageTryoutCatalog(ctx, snapshotId, index, row, rowJson)
    : stageTryoutPlacement(ctx, snapshotId, index, row, rowJson);
}

/** Resolves the next exact family-local row index from the prior batch. */
const nextRowIndex = Effect.fn("contentRelease.nextSnapshotRowIndex")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    family: "program" | "quran" | "tryout",
    batchIndex: number
  ) {
    if (batchIndex === 0) {
      return 0;
    }
    const previous = yield* Effect.promise(() =>
      ctx.db
        .query("snapshotBatches")
        .withIndex("by_releaseId_and_family_and_batchIndex", (query) =>
          query
            .eq("releaseId", releaseId)
            .eq("family", family)
            .eq("batchIndex", batchIndex - 1)
        )
        .unique()
    );
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
const stageBatch = Effect.fn("contentRelease.stageSnapshotBatch")(function* (
  ctx: MutationCtx,
  releaseId: string,
  family: "program" | "quran" | "tryout",
  snapshotId: string,
  batchIndex: number,
  sources: readonly string[]
) {
  const decoded = yield* decodeBatch(
    releaseId,
    family,
    snapshotId,
    batchIndex,
    sources
  );
  const entries = decoded.rows.map((row) => ({
    row,
    rowJson: encodeSnapshotRowJson(row),
  }));
  const values = entries.map(({ rowJson }) => rowJson);
  const batchHash = yield* hashBatch("snapshot", releaseId, batchIndex, [
    family,
    snapshotId,
    ...values,
  ]);
  const { release } = yield* loadStaged(ctx, releaseId);
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
  const storedManifest = yield* loadSnapshot(ctx, family, snapshotId);
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
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("snapshotBatches")
      .withIndex("by_releaseId_and_family_and_batchIndex", (query) =>
        query
          .eq("releaseId", releaseId)
          .eq("family", family)
          .eq("batchIndex", batchIndex)
      )
      .unique()
  );
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
  const firstIndex = yield* nextRowIndex(ctx, releaseId, family, batchIndex);
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
        ctx,
        snapshotId,
        firstIndex + offset,
        entry.row,
        entry.rowJson
      )
    ) {
      unchanged += 1;
    }
  }
  const now = Date.now();
  yield* Effect.promise(() =>
    ctx.db.insert("snapshotBatches", {
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
  );
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      stagedSnapshotBatches: release.stagedSnapshotBatches + 1,
      stagedSnapshotRows: release.stagedSnapshotRows + values.length,
      updatedAt: now,
    })
  );
  return {
    batchIndex,
    created: values.length - unchanged,
    family,
    releaseId,
    snapshotId,
    unchanged,
  };
});

/** Stages one bounded structured-row batch through internal state. */
export const stageSnapshotBatch = internalMutation({
  args: {
    batchIndex: v.number(),
    family: v.union(
      v.literal("program"),
      v.literal("quran"),
      v.literal("tryout")
    ),
    releaseId: v.string(),
    rowJson: v.array(v.string()),
    snapshotId: v.string(),
  },
  returns: snapshotBatchReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      stageBatch(
        ctx,
        args.releaseId,
        args.family,
        args.snapshotId,
        args.batchIndex,
        args.rowJson
      )
    ),
});
