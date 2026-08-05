import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect } from "effect";

/** Resolves one localized public path against its active signed try-out owner. */
export const readTryoutRoute = Effect.fn("tryouts.catalog.readTryoutRoute")(
  function* (
    ctx: QueryCtx,
    input: { readonly locale: ContentLocale; readonly publicPath: string }
  ) {
    const owner = yield* loadTryoutOwner(ctx);

    const row = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_locale_and_publicPath", (index) =>
          index
            .eq("snapshotId", owner.snapshotId)
            .eq("locale", input.locale)
            .eq("publicPath", input.publicPath)
        )
        .unique()
    );
    if (!row) {
      return { exists: false };
    }

    yield* verifyTryoutCatalog(row, owner.snapshotId);
    return { exists: true };
  }
);
