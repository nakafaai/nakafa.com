import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import type { locales } from "@repo/utilities/locales";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect } from "effect";

export const tryoutMetadataArgsValidator = {
  kind: literals("country", "exam", "track", "set", "section"),
  locale: localeValidator,
  publicPath: v.string(),
};

const tryoutAlternateValidator = v.object({
  locale: localeValidator,
  publicPath: v.string(),
});

export const tryoutMetadataReturnValidator = v.object({
  route: v.union(
    v.null(),
    v.object({
      alternates: v.array(tryoutAlternateValidator),
      description: v.optional(v.string()),
      publicPath: v.string(),
      title: v.string(),
    })
  ),
});

type TryoutRouteKind = TryoutCatalogRow["kind"];

interface TryoutMetadataInput {
  readonly kind: TryoutRouteKind;
  readonly locale: (typeof locales)[number];
  readonly publicPath: string;
}

/** Reads one route and its localized counterparts from signed ownership. */
export const readTryoutMetadata = Effect.fn("tryouts.catalog.readMetadata")(
  function* (ctx: QueryCtx, input: TryoutMetadataInput) {
    const owner = yield* loadTryoutOwner(ctx);
    const { snapshot, snapshotId } = owner;
    const storedCurrent = yield* Effect.promise(() =>
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
    if (!storedCurrent) {
      return { route: null };
    }
    const current = yield* verifyTryoutCatalog(storedCurrent, snapshotId);
    if (current.kind !== input.kind || !current.publicPath) {
      return { route: null };
    }
    const currentPublicPath = current.publicPath;

    const alternateRows = yield* Effect.forEach(
      snapshot.manifest.locales,
      (locale) =>
        readAlternate(ctx, {
          current,
          locale,
          snapshotId,
        })
    );
    const alternates = alternateRows.flatMap((alternate) =>
      alternate ? [alternate] : []
    );

    return {
      route: {
        alternates,
        description: current.description,
        publicPath: currentPublicPath,
        title: current.title,
      },
    };
  }
);

/** Reads one exact localized counterpart without loading another catalog. */
const readAlternate = Effect.fn("tryouts.catalog.readMetadataAlternate")(
  function* (
    ctx: QueryCtx,
    input: {
      readonly current: TryoutCatalogRow;
      readonly locale: (typeof locales)[number];
      readonly snapshotId: string;
    }
  ) {
    const identity = tryoutCatalogIdentity({
      ...input.current,
      locale: input.locale,
    });
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (index) =>
          index.eq("snapshotId", input.snapshotId).eq("identity", identity)
        )
        .unique()
    );
    if (!stored) {
      return null;
    }
    const alternate = yield* verifyTryoutCatalog(stored, input.snapshotId);
    if (!alternate.publicPath) {
      return null;
    }
    return {
      locale: alternate.locale,
      publicPath: alternate.publicPath,
    };
  }
);
