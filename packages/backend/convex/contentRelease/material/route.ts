import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { requireMaterialState } from "@repo/backend/convex/contentRelease/material/owner";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { resolveActiveRoute } from "@repo/backend/convex/contentRelease/scope/route";
import { Effect } from "effect";

/** Resolves one active material route and its authenticated catalog row. */
export const resolveMaterialRoute = Effect.fn(
  "contentRelease.resolveMaterialRoute"
)(function* (
  ctx: QueryCtx,
  locale: Doc<"materialCatalog">["locale"],
  publicPath: string
) {
  const route = yield* resolveActiveRoute(ctx, "material", locale, publicPath);
  if (!(route.managed && route.active)) {
    return {
      active: route.active,
      managed: false,
      material: null,
    };
  }
  yield* requireMaterialState(route.active, locale);
  if (!route.projection) {
    return {
      active: route.active,
      managed: true,
      material: null,
    };
  }
  const row = yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_contentKey_and_locale", (index) =>
        index.eq("contentKey", route.projection.contentKey).eq("locale", locale)
      )
      .unique()
  );
  if (!row) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active material ${route.projection.contentKey}/${locale} lost its catalog row.`
    );
  }
  const verified = yield* verifyMaterial(row);
  if (
    row.projectionHash !== route.projection.projectionHash ||
    row.rendererDomain !== route.projection.rendererDomain ||
    row.sourcePath !== route.projection.sourcePath ||
    verified.projectionJson !== route.projection.projectionJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active material ${route.projection.contentKey}/${locale} disagrees with its published route.`
    );
  }
  return {
    active: route.active,
    managed: true,
    material: { ...verified, row },
  };
});
