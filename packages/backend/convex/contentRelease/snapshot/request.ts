import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot";
import {
  MAX_SNAPSHOT_BATCH_BYTES,
  MAX_SNAPSHOT_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import { StageSnapshotBatchInputSchema } from "@nakafa/aksara-contracts/transport/snapshot";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { getConvexSize } from "convex/values";
import { Effect, Schema } from "effect";

/** Strictly decodes one bounded structured-row request at the mutation seam. */
export const decodeSnapshotBatch = Effect.fn(
  "contentRelease.decodeSnapshotBatch"
)(function* (
  releaseId: string,
  family: ContentSnapshotKind,
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
