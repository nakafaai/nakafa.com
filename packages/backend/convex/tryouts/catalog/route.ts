import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { readTryoutCatalogRowByPath } from "@repo/backend/convex/tryouts/catalog/row";
import { Effect } from "effect";

/** Resolves one localized public path against its active signed try-out owner. */
export const readTryoutRoute = Effect.fn("tryouts.catalog.readTryoutRoute")(
  function* (
    ctx: QueryCtx,
    input: { readonly locale: ContentLocale; readonly publicPath: string }
  ) {
    const owner = yield* loadTryoutOwner(ctx);

    const row = yield* readTryoutCatalogRowByPath(ctx, owner.snapshotId, input);
    if (!row) {
      return { exists: false };
    }

    return { exists: true };
  }
);
