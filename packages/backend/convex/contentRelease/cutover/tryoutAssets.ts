import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import { AUDITED_TRYOUT_CATALOG_COUNT } from "@repo/backend/convex/contentRelease/cutover/inventory";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const tryoutAssetProofValidator = v.object({
  complete: v.literal(true),
  total: v.number(),
});

const tryoutAssetReceiptValidator = v.object({
  complete: v.literal(true),
  total: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

type ReadCtx = MutationCtx | QueryCtx;
interface AuthenticatedTryoutAsset {
  readonly assetId: string;
  readonly row: Doc<"tryoutCatalog">;
}

/** Authenticates the active signed try-out catalog and graph identities. */
const authenticateTryoutAssets = Effect.fn(
  "contentRelease.cutover.authenticateTryoutAssets"
)(function* (ctx: ReadCtx, expectedCount: number) {
  const selected = yield* loadTryoutOwner(ctx);
  if (selected.snapshot.family !== "tryout") {
    return yield* tryoutAssetFailure(
      "The active verified try-out snapshot has another family."
    );
  }
  const signedCount = Object.values(selected.snapshot.manifest.counts).reduce(
    (total, count) => total + count,
    0
  );
  if (signedCount !== expectedCount) {
    return yield* tryoutAssetFailure(
      `The signed snapshot declares ${signedCount} catalog rows instead of ${expectedCount}.`
    );
  }

  const rows = yield* Effect.promise(() =>
    ctx.db.query("tryoutCatalog").take(expectedCount + 1)
  );
  if (rows.length !== expectedCount) {
    return yield* tryoutAssetFailure(
      `Expected ${expectedCount} try-out catalog rows but found ${rows.length}.`
    );
  }

  const identities = new Set<string>();
  const authenticated: AuthenticatedTryoutAsset[] = [];
  for (const row of rows) {
    if (row.snapshotId !== selected.snapshotId) {
      return yield* tryoutAssetFailure(
        `Try-out catalog row ${row.identity} belongs to another snapshot.`
      );
    }
    const signed = yield* verifyTryoutCatalog(row, selected.snapshotId);
    const assetId = signed.graph.assetId;
    const identity = `${row.locale}\0${assetId}`;
    if (identities.has(identity)) {
      return yield* tryoutAssetFailure(
        `Try-out asset ${row.locale}/${assetId} is not unique.`
      );
    }
    identities.add(identity);
    authenticated.push({ assetId, row });
  }
  return authenticated;
});

/** Proves every try-out row stores and resolves its signed graph asset ID. */
export const proveTryoutAssetIdsComplete = Effect.fn(
  "contentRelease.cutover.proveTryoutAssetIdsComplete"
)(function* (ctx: ReadCtx, expectedCount: number) {
  yield* requireCutoverPhase(ctx, ["quiescent"]);
  const authenticated = yield* authenticateTryoutAssets(ctx, expectedCount);
  for (const { assetId, row } of authenticated) {
    if (row.assetId !== assetId) {
      return yield* tryoutAssetFailure(
        `Try-out catalog row ${row.identity} has no exact stored asset ID.`
      );
    }
    const indexed = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_locale_and_assetId", (index) =>
          index
            .eq("snapshotId", row.snapshotId)
            .eq("locale", row.locale)
            .eq("assetId", assetId)
        )
        .unique()
    );
    if (indexed?._id !== row._id) {
      return yield* tryoutAssetFailure(
        `Try-out asset ${row.locale}/${assetId} does not resolve exactly.`
      );
    }
  }
  return authenticated.length;
});

/** Authenticates and persists every signed try-out graph asset ID. */
export const stageTryoutAssetIds = Effect.fn(
  "contentRelease.cutover.stageTryoutAssetIds"
)(function* (ctx: MutationCtx, expectedCount: number) {
  yield* requireCutoverPhase(ctx, ["quiescent"]);
  const authenticated = yield* authenticateTryoutAssets(ctx, expectedCount);
  let unchanged = 0;
  let updated = 0;
  for (const { assetId, row } of authenticated) {
    if (row.assetId !== undefined) {
      if (row.assetId !== assetId) {
        return yield* tryoutAssetFailure(
          `Try-out catalog row ${row.identity} has a different stored asset ID.`
        );
      }
      unchanged += 1;
      continue;
    }
    yield* Effect.promise(() =>
      ctx.db.patch("tryoutCatalog", row._id, { assetId })
    );
    updated += 1;
  }
  return {
    complete: true as const,
    total: authenticated.length,
    unchanged,
    updated,
  };
});

/** Bounded production-only staging for the exact audited try-out inventory. */
export const stage = internalMutation({
  args: {},
  returns: tryoutAssetReceiptValidator,
  handler: (ctx) =>
    runConvexProgram(stageTryoutAssetIds(ctx, AUDITED_TRYOUT_CATALOG_COUNT)),
});

/** Read-only acceptance proof for the staged try-out asset identities. */
export const prove = internalQuery({
  args: {},
  returns: tryoutAssetProofValidator,
  handler: (ctx) =>
    runConvexProgram(
      proveTryoutAssetIdsComplete(ctx, AUDITED_TRYOUT_CATALOG_COUNT).pipe(
        Effect.map((total) => ({ complete: true as const, total }))
      )
    ),
});

function tryoutAssetFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Try-out reader cutover: ${message}`
  );
}
