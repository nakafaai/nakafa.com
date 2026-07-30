import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadMaterialCatalogOwner,
  loadMaterialIdentityOwner,
} from "@repo/backend/convex/contentRelease/material/owner";
import { resolveMaterialRoute } from "@repo/backend/convex/contentRelease/material/route";
import type { MaterialLookupInput } from "@repo/backend/convex/contentRelease/material/spec";
import { Effect } from "effect";

/** Selects the public identity required for one signed material read. */
function publicIdentity(
  material: NonNullable<
    Effect.Effect.Success<ReturnType<typeof resolveMaterialRoute>>["material"]
  >
) {
  return {
    locale: material.row.locale,
    publicPath: material.row.publicPath,
  };
}

/** Resolves one public material route through active release ownership. */
const lookupMaterialRoute = Effect.fn("contentRelease.lookupMaterialRoute")(
  function* (
    ctx: QueryCtx,
    input: Extract<MaterialLookupInput, { kind: "route" }>
  ) {
    const resolved = yield* resolveMaterialRoute(
      ctx,
      input.locale,
      input.publicPath
    );

    return {
      activeReleaseId: resolved.active?.releaseId ?? null,
      managed: resolved.managed,
      route: resolved.material ? publicIdentity(resolved.material) : null,
    };
  }
);

/** Resolves one graph asset through the active material catalog. */
const lookupMaterialContent = Effect.fn("contentRelease.lookupMaterialContent")(
  function* (
    ctx: QueryCtx,
    input: Extract<MaterialLookupInput, { kind: "content" }>
  ) {
    const catalog = yield* loadMaterialCatalogOwner(ctx);
    const rows = (yield* Effect.forEach(
      ContentLocaleSchema.literals,
      (locale) =>
        Effect.promise(() =>
          ctx.db
            .query("materialCatalog")
            .withIndex("by_locale_and_assetId", (index) =>
              index.eq("locale", locale).eq("assetId", input.contentId)
            )
            .unique()
        )
    )).filter((row) => row !== null);

    if (rows.length > 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material asset ${input.contentId} resolves multiple locales.`
      );
    }

    const row = rows.at(0);
    if (row) {
      const resolved = yield* resolveMaterialRoute(
        ctx,
        row.locale,
        row.publicPath
      );
      return {
        activeReleaseId: resolved.active?.releaseId ?? null,
        managed: resolved.managed,
        route: resolved.material ? publicIdentity(resolved.material) : null,
      };
    }

    const source = yield* Effect.promise(() =>
      ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (index) =>
          index.eq("content_id", input.contentId)
        )
        .unique()
    );
    if (source?.section !== "material") {
      return {
        activeReleaseId: catalog.active?.releaseId ?? null,
        managed: catalog.familyManaged,
        route: null,
      };
    }
    const owner = yield* loadMaterialIdentityOwner(
      ctx,
      source.sourcePath,
      source.locale
    );
    if (!(owner.active && owner.managed)) {
      return {
        activeReleaseId: owner.active?.releaseId ?? null,
        managed: false,
        route: null,
      };
    }
    const projection = yield* resolvePublicProjection(
      ctx,
      source.sourcePath,
      source.locale,
      owner.active.sequence
    );
    if (!projection) {
      return {
        activeReleaseId: owner.active.releaseId,
        managed: true,
        route: null,
      };
    }
    if (projection.family !== "material") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material ${source.sourcePath}/${source.locale} resolved another family.`
      );
    }
    const resolved = yield* resolveMaterialRoute(
      ctx,
      projection.locale,
      projection.publicPath
    );
    return {
      activeReleaseId: resolved.active?.releaseId ?? null,
      managed: resolved.managed,
      route: resolved.material ? publicIdentity(resolved.material) : null,
    };
  }
);

/** Resolves an agent reference to the one active signed material route. */
export const lookupMaterial = Effect.fn("contentRelease.lookupMaterial")(
  function* (ctx: QueryCtx, input: MaterialLookupInput) {
    if (input.kind === "route") {
      return yield* lookupMaterialRoute(ctx, input);
    }

    return yield* lookupMaterialContent(ctx, input);
  }
);
