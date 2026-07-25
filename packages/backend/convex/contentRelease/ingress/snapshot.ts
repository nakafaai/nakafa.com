"use node";

import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import {
  hashCurriculumRow,
  hashProgramRow,
} from "@nakafa/aksara-contracts/program/row-hash";
import { hashProgramSnapshot } from "@nakafa/aksara-contracts/program/snapshot-hash";
import { hashQuranRow } from "@nakafa/aksara-contracts/quran/row-hash";
import { hashQuranSnapshot } from "@nakafa/aksara-contracts/quran/snapshot-hash";
import type {
  ContentSnapshotManifest,
  ContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import {
  makeTryoutCatalogRecord,
  makeTryoutPlacementRecord,
} from "@nakafa/aksara-contracts/tryout/row-hash";
import { makeTryoutSnapshot } from "@nakafa/aksara-contracts/tryout/snapshot-hash";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type { snapshotBatchReceiptValidator } from "@repo/backend/convex/contentRelease/spec";
import {
  encodeSnapshotJson,
  encodeSnapshotRowJson,
} from "@repo/backend/convex/contentRelease/wire";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type SnapshotRequest = Extract<
  PublicationRequest,
  { readonly operation: "stageSnapshot" }
>;
type SnapshotBatchRequest = Extract<
  PublicationRequest,
  { readonly operation: "stageSnapshotBatch" }
>;
type SnapshotBatchReceipt = Infer<typeof snapshotBatchReceiptValidator>;
type SnapshotFamily = ContentSnapshotManifest["family"];

const snapshotReference = makeFunctionReference<
  "mutation",
  { releaseId: string; snapshotJson: string },
  {
    created: 0 | 1;
    family: SnapshotFamily;
    releaseId: string;
    snapshotId: string;
    unchanged: 0 | 1;
  }
>("contentRelease/snapshot/manifest:stageSnapshot");
const snapshotBatchReference = makeFunctionReference<
  "mutation",
  {
    batchIndex: number;
    family: SnapshotFamily;
    releaseId: string;
    rowJson: string[];
    snapshotId: string;
  },
  SnapshotBatchReceipt
>("contentRelease/snapshot/batch:stageSnapshotBatch");

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
  return Effect.try({ catch: contractFailure, try: evaluate });
}

/** Recomputes one manifest self-hash before its global row is written. */
export const verifySnapshotManifest = Effect.fn(
  "contentRelease.verifySnapshotManifest"
)(function* (snapshot: ContentSnapshotManifest) {
  if (snapshot.family === "program") {
    const { snapshotId, ...identity } = snapshot.manifest;
    const actual = yield* hashProgramSnapshot(identity).pipe(
      Effect.mapError(contractFailure)
    );
    return yield* requireHash(actual, snapshotId, "Program snapshot manifest");
  }
  if (snapshot.family === "quran") {
    const { snapshotId, ...identity } = snapshot.manifest;
    const actual = yield* hashQuranSnapshot(identity).pipe(
      Effect.mapError(contractFailure)
    );
    return yield* requireHash(actual, snapshotId, "Quran snapshot manifest");
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
      const actual = yield* (
        row.record.kind === "program"
          ? hashProgramRow(row.record.row)
          : hashCurriculumRow(row.record.row)
      ).pipe(Effect.mapError(contractFailure));
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
    { discard: true }
  );
});

/** Verifies and stages one immutable structured-family manifest. */
export const stageSnapshot = Effect.fn("contentRelease.stageSnapshot")(
  function* (ctx: ActionCtx, request: SnapshotRequest) {
    yield* verifySnapshotManifest(request.snapshot);
    return yield* callInternal(() =>
      ctx.runMutation(snapshotReference, {
        releaseId: request.releaseId,
        snapshotJson: encodeSnapshotJson(request.snapshot),
      })
    );
  }
);

/** Verifies and stages one bounded structured-family row batch. */
export const stageSnapshotBatch = Effect.fn(
  "contentRelease.stageSnapshotBatch"
)(function* (ctx: ActionCtx, request: SnapshotBatchRequest) {
  yield* verifySnapshotBatch(request.family, request.snapshotId, request.rows);
  return yield* callInternal(() =>
    ctx.runMutation(snapshotBatchReference, {
      batchIndex: request.batchIndex,
      family: request.family,
      releaseId: request.releaseId,
      rowJson: request.rows.map(encodeSnapshotRowJson),
      snapshotId: request.snapshotId,
    })
  );
});
