import {
  readMaterialPagination,
  readParentMaterialRoute,
  toLocalizedContentHref,
} from "@repo/contents/_types/route/content";
import { readStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { Effect, Either } from "effect";
import {
  MaterialRouteError,
  readMaterialRoutes,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/data";

/** Resolves the topic route without starting a timestamped Effect fiber. */
export function resolveParent(route: PublicContentRoute) {
  const parent = readParentMaterialRoute(route, readMaterialRoutes());

  if (parent?.kind !== "subject-topic") {
    return Either.left(
      new MaterialRouteError({
        reason: "parent-route",
        value: route.publicPath,
      })
    );
  }

  return Either.right(parent);
}

/** Resolves the topic route that structurally owns one lesson route. */
export const requireParentMaterialRoute = Effect.fn(
  "NakafaContent.requireParentMaterialRoute"
)((route: PublicContentRoute) => {
  const parent = resolveParent(route);

  return Either.isLeft(parent)
    ? Effect.fail(parent.left)
    : Effect.succeed(parent.right);
});

/** Resolves the material header link from an explicit curriculum context. */
export function readMaterialHeaderLink(
  route: PublicContentRoute,
  context: MaterialContextIdentity | undefined
) {
  return readStaticPublicLearningIndex().resolveMaterialHeaderLink({
    context,
    route,
  });
}

/** Builds sibling pagination while preserving a validated source context. */
export function readMaterialPagePagination(
  route: PublicContentRoute,
  context: MaterialContextIdentity | undefined
) {
  const index = readStaticPublicLearningIndex();

  if (!(context && index.resolveMaterialHeaderLink({ context, route }))) {
    return readMaterialPagination(route, readMaterialRoutes());
  }

  return readMaterialPagination(route, readMaterialRoutes(), {
    toHref: (targetRoute) =>
      index.toContextualMaterialHref({
        context,
        href: toLocalizedContentHref(targetRoute),
        route: targetRoute,
      }),
  });
}
