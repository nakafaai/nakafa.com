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

interface ProtectedMaterialScope {
  readonly exact: boolean;
  readonly release: ProtectedMaterialRelease;
}

interface ProtectedRouteOwner {
  readonly contentKey: string;
  readonly exact: boolean;
}

/** Resolves whether one retained release owns all or exact materials. */
const loadProtectedScope = Effect.fn(
  "contentRelease.loadProtectedMaterialScope"
)(function* (release: ProtectedMaterialRelease) {
  const families = yield* loadReleaseFamilies(release);
  return {
    exact: !families.result.includes("material"),
    release,
  } satisfies ProtectedMaterialScope;
});

/** Resolves one protected material owner through its immutable route binding. */
const loadRouteOwner = Effect.fn("contentRelease.loadMaterialRouteOwner")(
  function* (
    ctx: MutationCtx,
    scope: ProtectedMaterialScope,
    route: SourceRoute
  ) {
    const { release } = scope;
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
    if (scope.exact) {
      const owner = yield* loadContentOwner(
        ctx,
        binding.contentKey,
        route.locale,
        release.sequence
      );
      if (!(owner?.managed && owner.family === "material")) {
        return null;
      }
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
    return {
      contentKey: binding.contentKey,
      exact: scope.exact,
    } satisfies ProtectedRouteOwner;
  }
);

/** Proves one active exact owner remains in its finalized owner snapshot. */
const validateActiveOwner = Effect.fn(
  "contentRelease.validateActiveMaterialRouteOwner"
)(function* (
  ctx: MutationCtx,
  active: ProtectedMaterialRelease,
  route: SourceRoute,
  owner: ProtectedRouteOwner
) {
  if (!owner.exact) {
    return owner.contentKey;
  }
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("materialOwners")
      .withIndex("by_contentKey_and_locale", (index) =>
        index.eq("contentKey", owner.contentKey).eq("locale", route.locale)
      )
      .unique()
  );
  if (
    !stored ||
    stored.releaseId !== active.releaseId ||
    stored.sequence !== active.sequence
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active release ${active.releaseId} lost exact material owner ${owner.contentKey}/${route.locale}.`
    );
  }
  return owner.contentKey;
});

/** Rejects changed source routes that collide with protected materials. */
export const validateSourceMaterialRoutes = Effect.fn(
  "contentRelease.validateSourceMaterialRoutes"
)(function* (ctx: MutationCtx, routes: readonly SourceRoute[]) {
  const protection = yield* loadMaterialProtection(ctx);
  const [active, recovery] = yield* Effect.all([
    protection.active
      ? loadProtectedScope(protection.active)
      : Effect.succeed(null),
    protection.recovery
      ? loadProtectedScope(protection.recovery)
      : Effect.succeed(null),
  ]);
  yield* Effect.forEach(
    routes,
    (route) =>
      Effect.gen(function* () {
        const activeOwner = active
          ? yield* loadRouteOwner(ctx, active, route)
          : null;
        const protectedActiveOwner =
          active && activeOwner
            ? yield* validateActiveOwner(
                ctx,
                active.release,
                route,
                activeOwner
              )
            : null;
        const recoveryOwner = recovery
          ? yield* loadRouteOwner(ctx, recovery, route)
          : null;
        if (
          protectedActiveOwner &&
          recoveryOwner &&
          protectedActiveOwner !== recoveryOwner.contentKey
        ) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Active and retained recovery releases conflict on material route ${route.locale}/${route.publicPath}.`
          );
        }
        const owner = protectedActiveOwner ?? recoveryOwner?.contentKey;
        if (!owner || owner === route.sourcePath) {
          return;
        }
        return yield* releaseFail(
          "CONTENT_RELEASE_ROUTE",
          `Source route ${route.locale}/${route.publicPath} conflicts with protected material ${owner}.`
        );
      }),
    { discard: true }
  );
});
