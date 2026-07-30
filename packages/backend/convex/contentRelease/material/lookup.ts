import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialCatalogOwner } from "@repo/backend/convex/contentRelease/material/owner";
import {
  readVisibleMaterial,
  resolveMaterialRoute,
} from "@repo/backend/convex/contentRelease/material/route";
import type { MaterialLookupInput } from "@repo/backend/convex/contentRelease/material/spec";
import { Effect } from "effect";

/** Selects the public identity required for one signed material read. */
function publicIdentity(
  material: NonNullable<
    Effect.Effect.Success<ReturnType<typeof readVisibleMaterial>>
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
    if (!row) {
      return {
        activeReleaseId: catalog.active?.releaseId ?? null,
        managed: catalog.familyManaged,
        route: null,
      };
    }

    const material = yield* readVisibleMaterial(
      ctx,
      row,
      catalog.familyManaged
    );
    return {
      activeReleaseId: catalog.active?.releaseId ?? null,
      managed: material !== null,
      route: material ? publicIdentity(material) : null,
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
