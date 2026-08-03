import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { hasLocale } from "next-intl";
import { readPublishedMaterialClaims } from "@/lib/content/material/ownership";
import { matchesPreviewRoute } from "@/lib/content/preview/route";
import { readPublishedProgramPath } from "@/lib/content/program/path";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { readActiveContentRoute } from "@/lib/content/published/route";
import {
  getRuntimePublicRoute,
  getRuntimeTryoutRoute,
} from "@/lib/content/runtime/routes";

/** Resolves one material HTML route against a single active release snapshot. */
const readProjectedMaterialRouteRejection = Effect.fn(
  "www.routing.publicHtml.materialRejection"
)(function* (locale: "en" | "id", publicPath: string) {
  if (yield* matchesPreviewRoute({ locale, publicPath })) {
    return null;
  }
  const identity = yield* readActiveContentIdentity();
  const activeReleaseId = identity?.releaseId ?? null;
  const ownership = yield* readActiveContentRoute({
    activeReleaseId,
    family: "material",
    locale,
    publicPath,
  });
  if (ownership.kind === "found") {
    return null;
  }
  if (ownership.kind === "missing") {
    return locale;
  }
  const route = yield* getRuntimePublicRoute({ locale, publicPath });
  if (route?.kind !== "subject-lesson" || !route.sourcePath) {
    return locale;
  }
  const claims = yield* readPublishedMaterialClaims(
    locale,
    [{ contentKey: route.sourcePath, locale: route.locale }],
    activeReleaseId
  );
  return claims.some(
    (claim) =>
      claim.contentKey === route.sourcePath && claim.locale === route.locale
  )
    ? locale
    : null;
});

/**
 * Reads projected HTML routes that must return a hard 404 when absent.
 *
 * AFDocs checks fabricated URLs for soft 404s. The exact Convex lookup keeps
 * that guarantee without rebuilding the complete content projection per
 * request.
 *
 * @see https://afdocs.dev/checks/url-stability
 */
export const readProjectedHtmlRouteRejection = Effect.fn(
  "www.routing.publicHtml.projectedRejection"
)(function* (pathname: string) {
  const [locale, namespace, ...pathSegments] = pathname
    .split("/")
    .filter(Boolean);

  if (!(namespace && hasLocale(routing.locales, locale))) {
    return null;
  }

  const surface = PUBLIC_ROUTE_SURFACES.find(
    (item) => item.routeSlugs[locale] === namespace
  );

  if (!surface) {
    return null;
  }

  if (
    pathSegments.length === 0 &&
    (surface.key === "curriculum" || surface.key === "tryout")
  ) {
    return null;
  }

  const publicPath = [namespace, ...pathSegments].join("/");
  if (surface.key === "subject") {
    return yield* readProjectedMaterialRouteRejection(locale, publicPath);
  }
  if (surface.key === "curriculum") {
    const ownership = yield* readPublishedProgramPath(locale, publicPath);
    if (ownership.managed) {
      return ownership.route?.sitemap ? null : locale;
    }
  }
  if (surface.key === "tryout") {
    if (pathSegments.length === 5) {
      return null;
    }
    const ownership = yield* getRuntimeTryoutRoute({ locale, publicPath });
    if (ownership.managed) {
      return ownership.exists ? null : locale;
    }
  }
  const route = yield* getRuntimePublicRoute({ locale, publicPath });
  if (!route) {
    return locale;
  }

  if (surface.key === "curriculum") {
    return route.kind === "curriculum-context" && route.sitemap ? null : locale;
  }

  return route.kind.startsWith("tryout-") ? null : locale;
});
