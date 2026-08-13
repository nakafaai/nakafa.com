import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import { AUDITED_QURAN_SEARCH_COUNT } from "@repo/backend/convex/contentRelease/cutover/inventory";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { authenticateQuranSearchHit } from "@repo/backend/convex/contentRelease/quran/search";
import { loadActiveSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const quranAssetProofValidator = v.object({
  complete: v.literal(true),
  total: v.number(),
});

const quranAssetReceiptValidator = v.object({
  complete: v.literal(true),
  total: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

type ReadCtx = MutationCtx | QueryCtx;
interface AuthenticatedQuranAsset {
  readonly assetId: string;
  readonly row: Doc<"quranSearch">;
}

/** Authenticates the active signed Quran search inventory and graph identities. */
const authenticateQuranAssets = Effect.fn(
  "contentRelease.cutover.authenticateQuranAssets"
)(function* (ctx: ReadCtx, expectedCount: number) {
  const selected = yield* loadActiveSnapshot(ctx, "quran");
  if (!(selected && selected.snapshot.family === "quran")) {
    return yield* quranAssetFailure(
      "The active verified Quran snapshot is unavailable."
    );
  }
  if (selected.snapshot.manifest.searchCount !== expectedCount) {
    return yield* quranAssetFailure(
      `The signed snapshot declares ${selected.snapshot.manifest.searchCount} search rows instead of ${expectedCount}.`
    );
  }

  const rows = yield* Effect.promise(() =>
    ctx.db.query("quranSearch").take(expectedCount + 1)
  );
  if (rows.length !== expectedCount) {
    return yield* quranAssetFailure(
      `Expected ${expectedCount} Quran search rows but found ${rows.length}.`
    );
  }

  const identities = new Set<string>();
  const authenticated: AuthenticatedQuranAsset[] = [];
  for (const row of rows) {
    if (row.snapshotId !== selected.snapshotId) {
      return yield* quranAssetFailure(
        `Quran search row ${row.identity} belongs to another snapshot.`
      );
    }
    const signed = yield* authenticateQuranSearchHit(
      ctx,
      selected.snapshotId,
      row
    );
    const assetId = signed.payload.graph.assetId;
    const identity = `${row.locale}\0${assetId}`;
    if (identities.has(identity)) {
      return yield* quranAssetFailure(
        `Quran asset ${row.locale}/${assetId} is not unique.`
      );
    }
    identities.add(identity);
    authenticated.push({ assetId, row });
  }
  return authenticated;
});

/** Proves every Quran search row stores and resolves its signed graph asset ID. */
export const proveQuranAssetIdsComplete = Effect.fn(
  "contentRelease.cutover.proveQuranAssetIdsComplete"
)(function* (ctx: ReadCtx, expectedCount: number) {
  yield* requireCutoverPhase(ctx, ["quiescent"]);
  const authenticated = yield* authenticateQuranAssets(ctx, expectedCount);
  for (const { assetId, row } of authenticated) {
    if (row.assetId !== assetId) {
      return yield* quranAssetFailure(
        `Quran search row ${row.identity} has no exact stored asset ID.`
      );
    }
    const indexed = yield* Effect.promise(() =>
      ctx.db
        .query("quranSearch")
        .withIndex("by_snapshotId_and_locale_and_assetId", (index) =>
          index
            .eq("snapshotId", row.snapshotId)
            .eq("locale", row.locale)
            .eq("assetId", assetId)
        )
        .unique()
    );
    if (indexed?._id !== row._id) {
      return yield* quranAssetFailure(
        `Quran asset ${row.locale}/${assetId} does not resolve exactly.`
      );
    }
  }
  return authenticated.length;
});

/** Authenticates and persists every signed Quran search graph asset ID. */
export const stageQuranAssetIds = Effect.fn(
  "contentRelease.cutover.stageQuranAssetIds"
)(function* (ctx: MutationCtx, expectedCount: number) {
  yield* requireCutoverPhase(ctx, ["quiescent"]);
  const authenticated = yield* authenticateQuranAssets(ctx, expectedCount);
  let unchanged = 0;
  let updated = 0;
  for (const { assetId, row } of authenticated) {
    if (row.assetId !== undefined) {
      if (row.assetId !== assetId) {
        return yield* quranAssetFailure(
          `Quran search row ${row.identity} has a different stored asset ID.`
        );
      }
      unchanged += 1;
      continue;
    }
    yield* Effect.promise(() =>
      ctx.db.patch("quranSearch", row._id, { assetId })
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

/** Bounded production-only staging for the exact audited Quran inventory. */
export const stage = internalMutation({
  args: {},
  returns: quranAssetReceiptValidator,
  handler: (ctx) =>
    runConvexProgram(stageQuranAssetIds(ctx, AUDITED_QURAN_SEARCH_COUNT)),
});

/** Read-only acceptance proof for the staged Quran asset identities. */
export const prove = internalQuery({
  args: {},
  returns: quranAssetProofValidator,
  handler: (ctx) =>
    runConvexProgram(
      proveQuranAssetIdsComplete(ctx, AUDITED_QURAN_SEARCH_COUNT).pipe(
        Effect.map((total) => ({ complete: true as const, total }))
      )
    ),
});

function quranAssetFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Quran reader cutover: ${message}`
  );
}
