import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadMaterialProtection,
  type ProtectedMaterialRelease,
} from "@repo/backend/convex/contentRelease/material/protection";
import { loadRouteBinding } from "@repo/backend/convex/contentRelease/model";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { loadContentOwner } from "@repo/backend/convex/contentRelease/scope/owner";
import { Effect } from "effect";

interface SourceRoute {
  readonly locale: ContentLocale;
  readonly publicPath: string;
  readonly sourcePath?: string;
}

/** Resolves one exact material owner through the path's immutable binding. */
const loadRouteOwner = Effect.fn("contentRelease.loadMaterialRouteOwner")(
  function* (
    ctx: MutationCtx,
    release: ProtectedMaterialRelease,
    route: SourceRoute
  ) {
    const families = yield* loadReleaseFamilies(release);
    if (families.result.includes("material")) {
      return null;
    }
    const binding = yield* loadRouteBinding(
      ctx,
      route.locale,
      route.publicPath,
      release.sequence
    );
    if (!binding || binding.operation === "delete") {
      return null;
    }
    if (!binding.contentKey) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Release ${release.releaseId} route ${route.locale}/${route.publicPath} lost its content identity.`
      );
    }
    const owner = yield* loadContentOwner(
      ctx,
      binding.contentKey,
      route.locale,
      release.sequence
    );
    if (!(owner?.managed && owner.family === "material")) {
      return null;
    }
    const projection = yield* resolvePublicProjection(
      ctx,
      binding.contentKey,
      route.locale,
      release.sequence
    );
    if (
      projection?.family !== "material" ||
      projection.publicPath !== route.publicPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Release ${release.releaseId} lost exact material route ${route.locale}/${route.publicPath}.`
      );
    }
    return binding.contentKey;
  }
);

/** Proves one active exact owner remains in the finalized owner snapshot. */
const validateActiveOwner = Effect.fn(
  "contentRelease.validateActiveMaterialRouteOwner"
)(function* (
  ctx: MutationCtx,
  active: ProtectedMaterialRelease,
  route: SourceRoute,
  contentKey: string
) {
  const owner = yield* Effect.promise(() =>
    ctx.db
      .query("materialOwners")
      .withIndex("by_contentKey_and_locale", (index) =>
        index.eq("contentKey", contentKey).eq("locale", route.locale)
      )
      .unique()
  );
  if (
    !owner ||
    owner.releaseId !== active.releaseId ||
    owner.sequence !== active.sequence
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active release ${active.releaseId} lost exact material owner ${contentKey}/${route.locale}.`
    );
  }
  return contentKey;
});

/** Rejects one changed source route that collides with protected material. */
export const validateSourceMaterialRoute = Effect.fn(
  "contentRelease.validateSourceMaterialRoute"
)(function* (ctx: MutationCtx, route: SourceRoute) {
  const protection = yield* loadMaterialProtection(ctx);
  const activeOwner = protection.active
    ? yield* loadRouteOwner(ctx, protection.active, route)
    : null;
  const protectedActiveOwner =
    protection.active && activeOwner
      ? yield* validateActiveOwner(ctx, protection.active, route, activeOwner)
      : null;
  const recoveryOwner = protection.recovery
    ? yield* loadRouteOwner(ctx, protection.recovery, route)
    : null;
  if (
    protectedActiveOwner &&
    recoveryOwner &&
    protectedActiveOwner !== recoveryOwner
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active and retained recovery releases conflict on exact material route ${route.locale}/${route.publicPath}.`
    );
  }
  const owner = protectedActiveOwner ?? recoveryOwner;
  if (!owner || owner === route.sourcePath) {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_ROUTE",
    `Source route ${route.locale}/${route.publicPath} conflicts with protected exact material ${owner}.`
  );
});
