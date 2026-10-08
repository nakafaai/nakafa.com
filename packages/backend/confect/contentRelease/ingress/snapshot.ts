"use node";

import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import {
  verifyProgramSnapshotHash,
  verifyProgramSnapshotRowHash,
} from "@nakafa/aksara-contracts/program/snapshot/hash";
import { verifyQuranSnapshotHash } from "@nakafa/aksara-contracts/quran/snapshot/hash";
import { hashQuranRow } from "@nakafa/aksara-contracts/quran/snapshot/row/hash";
import type {
  ContentSnapshotManifest,
  ContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import type {
  StageSnapshotBatchRequest,
  StageSnapshotRequest,
} from "@nakafa/aksara-contracts/transport/snapshot";
import { makeTryoutCatalogRecord } from "@nakafa/aksara-contracts/tryout/hash/catalog";
import { makeTryoutPlacementRecord } from "@nakafa/aksara-contracts/tryout/hash/placement";
import { makeTryoutSnapshot } from "@nakafa/aksara-contracts/tryout/snapshot/hash";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import {
  encodeSnapshotJson,
  encodeSnapshotRowJson,
} from "@repo/backend/confect/contentRelease/wire";
import { Array as Arr, Effect } from "effect";

/** Rejects one content identity mismatch before immutable storage. */
function requireHash(
  actual: Sha256Hash,
  expected: Sha256Hash,
  subject: string
) {
  return actual === expected
    ? Effect.void
    : releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `${subject} has an invalid content identity.`
      );
}

/** Safely evaluates a synchronous contract-owned hashing operation. */
function contractHash<A>(evaluate: () => A) {
  return Effect.try({
    catch: contractFailure,
    try: evaluate,
  });
}

/** Recomputes one manifest self-hash before its global row is written. */
export const verifySnapshotManifest = Effect.fn(
  "contentRelease.verifySnapshotManifest"
)(function* (snapshot: ContentSnapshotManifest) {
  if (snapshot.family === "program") {
    const actual = yield* verifyProgramSnapshotHash(snapshot.manifest).pipe(
      Effect.mapError(contractFailure)
    );
    return yield* requireHash(
      actual,
      snapshot.manifest.snapshotId,
      "Program snapshot manifest"
    );
  }
  if (snapshot.family === "quran") {
    const actual = yield* verifyQuranSnapshotHash(snapshot.manifest).pipe(
      Effect.mapError(contractFailure)
    );
    return yield* requireHash(
      actual,
      snapshot.manifest.snapshotId,
      "Quran snapshot manifest"
    );
  }
  const { snapshotId, ...identity } = snapshot.manifest;
  const actual = yield* contractHash(
    () => makeTryoutSnapshot(identity).snapshotId
  );
  return yield* requireHash(actual, snapshotId, "Try-out snapshot manifest");
});

/** Recomputes one row's intrinsic hash and immutable snapshot binding. */
const verifySnapshotRow = Effect.fn("contentRelease.verifySnapshotRow")(
  function* (
    family: ContentSnapshotManifest["family"],
    snapshotId: Sha256Hash,
    row: ContentSnapshotRow
  ) {
    if (row.family !== family) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Snapshot ${family}/${snapshotId} received a ${row.family} row.`
      );
    }
    if (row.family === "program") {
      const actual = yield* verifyProgramSnapshotRowHash(row.record).pipe(
        Effect.mapError(contractFailure)
      );
      return yield* requireHash(
        actual,
        row.record.rowHash,
        "Program snapshot row"
      );
    }
    if (row.family === "quran") {
      if (row.record.snapshotId !== snapshotId) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Quran row is not bound to snapshot ${snapshotId}.`
        );
      }
      const actual = yield* hashQuranRow(row.record.payload).pipe(
        Effect.mapError(contractFailure)
      );
      return yield* requireHash(
        actual,
        row.record.rowHash,
        "Quran snapshot row"
      );
    }
    if (row.rowKind === "catalog") {
      const actual = yield* contractHash(() =>
        makeTryoutCatalogRecord(row.record.row)
      );
      return yield* requireHash(
        actual.rowHash,
        row.record.rowHash,
        "Try-out snapshot row"
      );
    }
    const actual = yield* contractHash(() =>
      makeTryoutPlacementRecord(row.record.row)
    );
    return yield* requireHash(
      actual.rowHash,
      row.record.rowHash,
      "Try-out snapshot row"
    );
  }
);

/** Verifies every bounded row before any Edge mutation can persist it. */
export const verifySnapshotBatch = Effect.fn(
  "contentRelease.verifySnapshotBatch"
)(function* (
  family: ContentSnapshotManifest["family"],
  snapshotId: Sha256Hash,
  rows: readonly ContentSnapshotRow[]
) {
  yield* Effect.forEach(
    rows,
    (row) => verifySnapshotRow(family, snapshotId, row),
    {
      discard: true,
    }
  );
});

/** Verifies and stages one immutable structured-family manifest. */
export const stageSnapshot = Effect.fn("contentRelease.stageSnapshot")(
  function* (request: StageSnapshotRequest) {
    const { runMutation } = yield* MutationRunner;
    yield* verifySnapshotManifest(request.snapshot);
    return yield* runMutation(
      refs.internal.contentRelease.snapshot.manifest.stageSnapshot,
      {
        releaseId: request.releaseId,
        snapshotJson: encodeSnapshotJson(request.snapshot),
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
  }
);

/** Verifies and stages one bounded structured-family row batch. */
export const stageSnapshotBatch = Effect.fn(
  "contentRelease.stageSnapshotBatch"
)(function* (request: StageSnapshotBatchRequest) {
  const { runMutation } = yield* MutationRunner;
  yield* verifySnapshotBatch(request.family, request.snapshotId, request.rows);
  return yield* runMutation(
    refs.internal.contentRelease.snapshot.batch.stageSnapshotBatch,
    {
      batchIndex: request.batchIndex,
      family: request.family,
      releaseId: request.releaseId,
      rowJson: Arr.map(request.rows, encodeSnapshotRowJson),
      snapshotId: request.snapshotId,
    }
  ).pipe(Effect.catchTag("SchemaError", Effect.die));
});
