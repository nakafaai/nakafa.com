import type { TryoutCatalogRecord } from "@nakafa/aksara-contracts/tryout/catalog";
import type { TryoutPlacementRecord } from "@nakafa/aksara-contracts/tryout/placement";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  tryoutCatalogFacts,
  tryoutPlacementFacts,
} from "@repo/backend/confect/contentRelease/tryout/facts";
import {
  TRYOUT_CATALOG_DOCUMENT_LIMIT,
  TRYOUT_PLACEMENT_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/tryout/limits";
import { Effect } from "effect";

/** Stores one immutable try-out hierarchy row without flattening its body. */
export const stageTryoutCatalog = Effect.fn(
  "contentRelease.stageTryoutCatalog"
)(function* (
  snapshotId: string,
  index: number,
  record: TryoutCatalogRecord,
  rowJson: string
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const facts = tryoutCatalogFacts(record);
  const stored = {
    ...facts,
    index,
    rowHash: record.rowHash,
    rowJson,
    snapshotId,
  };
  yield* ensureDocumentSize(
    `Try-out snapshot ${snapshotId} row ${index}`,
    stored,
    TRYOUT_CATALOG_DOCUMENT_LIMIT
  );
  const byIndex = yield* database
    .table("tryoutCatalog")
    .get("by_snapshotId_and_index", snapshotId, index)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const byIdentity = yield* database
    .table("tryoutCatalog")
    .get("by_snapshotId_and_identity", snapshotId, facts.identity)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (byIndex || byIdentity) {
    if (
      !(byIndex && byIdentity) ||
      byIndex._id !== byIdentity._id ||
      byIndex.assetId !== stored.assetId ||
      byIndex.rowJson !== rowJson ||
      byIndex.rowHash !== record.rowHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Try-out snapshot ${snapshotId} has a catalog identity collision.`
      );
    }
    return true;
  }
  yield* writer.table("tryoutCatalog").insert(stored).pipe(Effect.orDie);
  return false;
});

/** Stores one immutable attempt placement with both signed artifact hashes. */
export const stageTryoutPlacement = Effect.fn(
  "contentRelease.stageTryoutPlacement"
)(function* (
  snapshotId: string,
  index: number,
  record: TryoutPlacementRecord,
  rowJson: string
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const facts = tryoutPlacementFacts(record);
  const stored = {
    ...facts,
    index,
    rowHash: record.rowHash,
    rowJson,
    snapshotId,
  };
  yield* ensureDocumentSize(
    `Try-out snapshot ${snapshotId} placement ${index}`,
    stored,
    TRYOUT_PLACEMENT_DOCUMENT_LIMIT
  );
  const byIndex = yield* database
    .table("tryoutPlacements")
    .get("by_snapshotId_and_index", snapshotId, index)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const byIdentity = yield* database
    .table("tryoutPlacements")
    .get("by_snapshotId_and_identity", snapshotId, facts.identity)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (byIndex || byIdentity) {
    if (
      !(byIndex && byIdentity) ||
      byIndex._id !== byIdentity._id ||
      byIndex.rowJson !== rowJson ||
      byIndex.rowHash !== record.rowHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Try-out snapshot ${snapshotId} has a placement identity collision.`
      );
    }
    return true;
  }
  yield* writer.table("tryoutPlacements").insert(stored).pipe(Effect.orDie);
  return false;
});
