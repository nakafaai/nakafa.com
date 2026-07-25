import type { ContentSnapshotManifest } from "@nakafa/aksara-contracts/release/snapshot-data";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadRelease } from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/convex/contentRelease/snapshot/manifest";
import { snapshotFamilyValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const rowPageValidator = v.object({
  batchIndex: v.number(),
  done: v.boolean(),
  firstIndex: v.number(),
  nextBatchIndex: v.number(),
  rowJson: v.array(v.string()),
  snapshotId: v.string(),
});

interface StoredRow {
  readonly index: number;
  readonly rowJson: string;
}

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
const loadRows = Effect.fn("contentRelease.loadSnapshotRows")(function* (
  ctx: QueryCtx,
  family: SnapshotFamily,
  snapshotId: string,
  firstIndex: number,
  rowCount: number
) {
  if (family === "program") {
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("programRows")
        .withIndex("by_snapshotId_and_index", (range) =>
          range
            .eq("snapshotId", snapshotId)
            .gte("index", firstIndex)
            .lte("index", firstIndex + rowCount - 1)
        )
        .take(rowCount + 1)
    );
    return yield* exactRowJson(rows, family, snapshotId, firstIndex, rowCount);
  }
  if (family === "quran") {
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("quranRows")
        .withIndex("by_snapshotId_and_index", (range) =>
          range
            .eq("snapshotId", snapshotId)
            .gte("index", firstIndex)
            .lte("index", firstIndex + rowCount - 1)
        )
        .take(rowCount + 1)
    );
    return yield* exactRowJson(rows, family, snapshotId, firstIndex, rowCount);
  }
  const [catalog, placements] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_index", (range) =>
          range
            .eq("snapshotId", snapshotId)
            .gte("index", firstIndex)
            .lte("index", firstIndex + rowCount - 1)
        )
        .take(rowCount + 1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_index", (range) =>
          range
            .eq("snapshotId", snapshotId)
            .gte("index", firstIndex)
            .lte("index", firstIndex + rowCount - 1)
        )
        .take(rowCount + 1)
    ),
  ]);
  const rows = [...catalog, ...placements].sort(
    (left, right) => left.index - right.index
  );
  return yield* exactRowJson(rows, family, snapshotId, firstIndex, rowCount);
});

/** Reads one exact family manifest selected by the staged release. */
const manifestProgram = Effect.fn("contentRelease.readSnapshotManifest")(
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
const rowPageProgram = Effect.fn("contentRelease.readSnapshotBatch")(function* (
  ctx: QueryCtx,
  releaseId: string,
  family: SnapshotFamily,
  afterBatchIndex: number
) {
  const release = yield* loadRelease(ctx, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const state = signed.manifest.snapshots[family];
  if (state.mode !== "replace" || state.resultSnapshotId === null) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Release ${releaseId} does not own ${family} snapshot rows.`
    );
  }
  const batch = yield* Effect.promise(() =>
    ctx.db
      .query("snapshotBatches")
      .withIndex("by_releaseId_and_family_and_batchIndex", (query) =>
        query
          .eq("releaseId", releaseId)
          .eq("family", family)
          .gt("batchIndex", afterBatchIndex)
      )
      .first()
  );
  if (!batch) {
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
    batch.snapshotId !== state.resultSnapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${releaseId} has a non-contiguous ${family} snapshot ledger.`
    );
  }
  const rowJson = yield* loadRows(
    ctx,
    family,
    batch.snapshotId,
    batch.firstIndex,
    batch.rowCount
  );
  const next = yield* Effect.promise(() =>
    ctx.db
      .query("snapshotBatches")
      .withIndex("by_releaseId_and_family_and_batchIndex", (query) =>
        query
          .eq("releaseId", releaseId)
          .eq("family", family)
          .gt("batchIndex", batch.batchIndex)
      )
      .first()
  );
  return {
    batchIndex: batch.batchIndex,
    done: next === null,
    firstIndex: batch.firstIndex,
    nextBatchIndex: batch.batchIndex,
    rowJson,
    snapshotId: batch.snapshotId,
  };
});

/** Internal exact manifest read used by the Node proof verifier. */
export const manifest = internalQuery({
  args: { family: snapshotFamilyValidator, releaseId: v.string() },
  returns: v.string(),
  handler: (ctx, args) =>
    runConvexProgram(manifestProgram(ctx, args.releaseId, args.family)),
});

/** Internal bounded row-batch read used by replayable proof streams. */
export const rows = internalQuery({
  args: {
    afterBatchIndex: v.number(),
    family: snapshotFamilyValidator,
    releaseId: v.string(),
  },
  returns: rowPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      rowPageProgram(ctx, args.releaseId, args.family, args.afterBatchIndex)
    ),
});
