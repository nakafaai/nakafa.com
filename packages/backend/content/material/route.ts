import { requireMaterialState } from "@repo/backend/content/material/owner";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyMaterialProjection } from "@repo/backend/content/material/verify";
import { resolveActiveRoute } from "@repo/backend/content/publication/route";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Option } from "effect";

/** Resolves one active material route and its authenticated catalog row. */
export const resolveMaterialRoute = Effect.fn(
  "contentRelease.resolveMaterialRoute"
)(function* (
  appLocale: Doc<"materialCatalog">["appLocale"],
  publicPath: string
) {
  const route = yield* resolveActiveRoute("material", appLocale, publicPath);
  if (!(route.managed && route.active)) {
    return {
      ...route,
      managed: false,
      material: null,
    };
  }
  const slot = yield* requireMaterialState(route.active, appLocale);
  if (!route.projection) {
    return {
      ...route,
      managed: true,
      material: null,
    };
  }
  const row = Option.getOrNull(
    yield* (yield* MaterialSource).material(
      slot,
      route.projection.contentKey,
      appLocale
    )
  );
  if (!row) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active material ${route.projection.contentKey}/${appLocale} lost its catalog row.`
    );
  }
  const verified = yield* verifyMaterialProjection(row, route.projection);
  return {
    ...route,
    managed: true,
    material: { ...verified, row },
  };
});
