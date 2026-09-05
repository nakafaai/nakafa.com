import { requireMaterialState } from "@repo/backend/content/material/owner";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyMaterial } from "@repo/backend/content/material/verify";
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
      active: route.active,
      managed: false,
      material: null,
    };
  }
  const slot = yield* requireMaterialState(route.active, appLocale);
  if (!route.projection) {
    return {
      active: route.active,
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
  const verified = yield* verifyMaterial(row);
  if (
    row.projectionHash !== route.projection.projectionHash ||
    row.publicPath !== route.projection.publicPath ||
    row.releaseId !== route.projection.releaseId ||
    row.rendererDomain !== route.projection.rendererDomain ||
    row.sequence !== route.projection.sequence ||
    row.sourcePath !== route.projection.sourcePath ||
    verified.projectionJson !== route.projection.projectionJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active material ${route.projection.contentKey}/${appLocale} disagrees with its published route.`
    );
  }
  return {
    active: route.active,
    managed: true,
    material: { ...verified, row },
  };
});
