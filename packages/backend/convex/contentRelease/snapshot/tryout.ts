import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot-data";
import {
  tryoutCatalogIdentity,
  tryoutCatalogParentIdentity,
  tryoutPlacementIdentity,
  tryoutPlacementParentIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

type TryoutRow = Extract<ContentSnapshotRow, { readonly family: "tryout" }>;
type CatalogRow = Extract<TryoutRow, { readonly rowKind: "catalog" }>;
type PlacementRow = Extract<TryoutRow, { readonly rowKind: "placement" }>;

/** Derives one localized hierarchy identity and its direct parent key. */
function catalogIdentity(source: CatalogRow) {
  const row = source.record.row;
  return {
    identity: tryoutCatalogIdentity(row),
    order: row.kind === "country" || row.kind === "exam" ? 0 : row.order,
    parentKey: tryoutCatalogParentIdentity(row),
  };
}

/** Stores one immutable try-out hierarchy row without flattening its body. */
export const stageTryoutCatalog = Effect.fn(
  "contentRelease.stageTryoutCatalog"
)(function* (
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  source: CatalogRow,
  rowJson: string
) {
  const row = source.record.row;
  const identity = catalogIdentity(source);
  const byIndex = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", snapshotId).eq("index", index)
      )
      .unique()
  );
  const byIdentity = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_identity", (query) =>
        query.eq("snapshotId", snapshotId).eq("identity", identity.identity)
      )
      .unique()
  );
  if (byIndex || byIdentity) {
    if (
      !(byIndex && byIdentity) ||
      byIndex._id !== byIdentity._id ||
      byIndex.rowJson !== rowJson ||
      byIndex.rowHash !== source.record.rowHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Try-out snapshot ${snapshotId} has a catalog identity collision.`
      );
    }
    return true;
  }
  const stored = {
    ...identity,
    index,
    kind: row.kind,
    locale: row.locale,
    publicPath: row.publicPath,
    rowHash: source.record.rowHash,
    rowJson,
    snapshotId,
  };
  yield* ensureDocumentSize(
    `Try-out snapshot ${snapshotId} row ${index}`,
    stored
  );
  yield* Effect.promise(() => ctx.db.insert("tryoutCatalog", stored));
  return false;
});

/** Stores one immutable attempt placement with both signed artifact hashes. */
export const stageTryoutPlacement = Effect.fn(
  "contentRelease.stageTryoutPlacement"
)(function* (
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  source: PlacementRow,
  rowJson: string
) {
  const row = source.record.row;
  const identity = tryoutPlacementIdentity(row);
  const byIndex = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", snapshotId).eq("index", index)
      )
      .unique()
  );
  const byIdentity = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_identity", (query) =>
        query.eq("snapshotId", snapshotId).eq("identity", identity)
      )
      .unique()
  );
  if (byIndex || byIdentity) {
    if (
      !(byIndex && byIdentity) ||
      byIndex._id !== byIdentity._id ||
      byIndex.rowJson !== rowJson ||
      byIndex.rowHash !== source.record.rowHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Try-out snapshot ${snapshotId} has a placement identity collision.`
      );
    }
    return true;
  }
  const stored = {
    answerArtifactHash: row.answerArtifactHash,
    identity,
    index,
    locale: row.locale,
    parentKey: tryoutPlacementParentIdentity(row),
    questionArtifactHash: row.questionArtifactHash,
    questionOrder: row.questionOrder,
    rowHash: source.record.rowHash,
    rowJson,
    snapshotId,
  };
  yield* ensureDocumentSize(
    `Try-out snapshot ${snapshotId} placement ${index}`,
    stored
  );
  yield* Effect.promise(() => ctx.db.insert("tryoutPlacements", stored));
  return false;
});
