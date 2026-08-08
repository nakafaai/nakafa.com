import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect } from "effect";

/** Reads and verifies one catalog row by its signed identity. */
export const readTryoutCatalogRowByIdentity = Effect.fn(
  "tryouts.catalog.readRowByIdentity"
)(function* (ctx: QueryCtx, snapshotId: string, identity: string) {
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_identity", (index) =>
        index.eq("snapshotId", snapshotId).eq("identity", identity)
      )
      .unique()
  );
  if (!stored) {
    return null;
  }
  return yield* verifyTryoutCatalog(stored, snapshotId);
});

/** Reads and verifies one catalog row by its localized public path. */
export const readTryoutCatalogRowByPath = Effect.fn(
  "tryouts.catalog.readRowByPath"
)(function* (
  ctx: QueryCtx,
  snapshotId: string,
  input: {
    readonly locale: ContentLocale;
    readonly publicPath: string;
  }
) {
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_locale_and_publicPath", (index) =>
        index
          .eq("snapshotId", snapshotId)
          .eq("locale", input.locale)
          .eq("publicPath", input.publicPath)
      )
      .unique()
  );
  if (!stored) {
    return null;
  }
  return yield* verifyTryoutCatalog(stored, snapshotId);
});
