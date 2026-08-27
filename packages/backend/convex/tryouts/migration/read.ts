"use node";

import {
  authenticateHistoricalArtifact,
  decodeStoredTryoutRow,
} from "@nakafa/aksara-contracts/history/decode";
import type { TryoutHistoryMigrationRequest } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type {
  rowPageValidator,
  storedArtifactValidator,
  storedRowValidator,
} from "@repo/backend/convex/tryouts/migration/pages";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type RowPageRequest = Extract<
  TryoutHistoryMigrationRequest,
  { readonly command: "rowPage" }
>;
type ArtifactBatchRequest = Extract<
  TryoutHistoryMigrationRequest,
  { readonly command: "artifactBatch" }
>;
type RowPage = Infer<typeof rowPageValidator>;
type StoredArtifact = Infer<typeof storedArtifactValidator>;
type StoredRow = Infer<typeof storedRowValidator>;

const rowPageReference = makeFunctionReference<
  "query",
  {
    afterIndex: number;
    rowKind: "catalog" | "placement";
    sourceSnapshotId: string;
  },
  RowPage
>("tryouts/migration/pages:rowPage");
const rowBatchReference = makeFunctionReference<
  "query",
  {
    rowHashes: string[];
    rowKind: "catalog" | "placement";
    sourceSnapshotId: string;
  },
  StoredRow[]
>("tryouts/migration/pages:rowBatch");
const artifactBatchReference = makeFunctionReference<
  "query",
  { artifactHashes: string[]; sourceSnapshotId: string },
  StoredArtifact[]
>("tryouts/migration/pages:artifactBatch");

/** Reauthenticates one stored historical row and its duplicated index facts. */
const decodeStoredRow = Effect.fn("tryouts.migration.decodeStoredRow")(
  function* (stored: StoredRow, expectedKind: "catalog" | "placement") {
    const row = yield* parseStoredJson(
      stored.rowJson,
      "Retained try-out row"
    ).pipe(
      Effect.flatMap(decodeStoredTryoutRow),
      Effect.mapError(contractFailure)
    );
    if (row.rowKind !== expectedKind || row.record.rowHash !== stored.rowHash) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Retained try-out row changed its stored identity."
      );
    }
    return row;
  }
);

/** Reads and authenticates one deterministic retained row page. */
export const readMigrationRowPage = Effect.fn("tryouts.migration.readRowPage")(
  function* (ctx: Pick<ActionCtx, "runQuery">, request: RowPageRequest) {
    const page = yield* callInternal(() =>
      ctx.runQuery(rowPageReference, {
        afterIndex: request.afterIndex,
        rowKind: request.rowKind,
        sourceSnapshotId: request.sourceSnapshotId,
      })
    );
    const rows = yield* Effect.forEach(page.rows, (row) =>
      decodeStoredRow(row, request.rowKind).pipe(
        Effect.map((decoded) => ({ index: row.index, row: decoded }))
      )
    );
    return {
      command: request.command,
      isDone: page.isDone,
      migrationId: request.releaseId,
      nextIndex: page.nextIndex,
      rowKind: request.rowKind,
      rows,
    };
  }
);

/** Loads authenticated retained rows selected by one conversion request. */
export const loadMigrationRowBatch = Effect.fn(
  "tryouts.migration.loadRowBatch"
)(function* (
  ctx: Pick<ActionCtx, "runQuery">,
  rowHashes: readonly string[],
  rowKind: "catalog" | "placement",
  sourceSnapshotId: string
) {
  const stored = yield* callInternal(() =>
    ctx.runQuery(rowBatchReference, {
      rowHashes: [...rowHashes],
      rowKind,
      sourceSnapshotId,
    })
  );
  if (
    stored.length !== rowHashes.length ||
    stored.some(({ rowHash }, index) => rowHash !== rowHashes[index])
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained try-out row batch changed request order."
    );
  }
  return yield* Effect.forEach(stored, (storedRow) =>
    decodeStoredRow(storedRow, rowKind).pipe(
      Effect.map((row) => ({ index: storedRow.index, row }))
    )
  );
});

/** Loads authenticated retained artifacts selected by one conversion request. */
export const loadMigrationArtifacts = Effect.fn(
  "tryouts.migration.loadArtifacts"
)(function* (
  ctx: Pick<ActionCtx, "runQuery">,
  artifactHashes: readonly string[],
  sourceSnapshotId: string
) {
  const stored = yield* callInternal(() =>
    ctx.runQuery(artifactBatchReference, {
      artifactHashes: [...artifactHashes],
      sourceSnapshotId,
    })
  );
  if (
    stored.length !== artifactHashes.length ||
    stored.some(
      ({ artifactHash }, index) => artifactHash !== artifactHashes[index]
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained try-out artifact batch changed request order."
    );
  }
  return yield* Effect.forEach(stored, ({ artifactJson }) =>
    parseStoredJson(artifactJson, "Retained try-out artifact").pipe(
      Effect.flatMap(authenticateHistoricalArtifact),
      Effect.mapError(contractFailure)
    )
  );
});

/** Reads and authenticates exact retained artifacts in request order. */
export const readMigrationArtifactBatch = Effect.fn(
  "tryouts.migration.readArtifactBatch"
)(function* (ctx: Pick<ActionCtx, "runQuery">, request: ArtifactBatchRequest) {
  const artifacts = yield* loadMigrationArtifacts(
    ctx,
    request.artifactHashes,
    request.sourceSnapshotId
  );
  return {
    artifacts,
    command: request.command,
    migrationId: request.releaseId,
  };
});
