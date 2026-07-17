import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { hasLocale } from "next-intl";
import { getRuntimePublicRoute } from "@/lib/content/runtime/routes";

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
  const route = yield* getRuntimePublicRoute({ locale, publicPath });

  if (!route) {
    return locale;
  }

  if (surface.key === "subject") {
    return route.kind === "subject-lesson" ? null : locale;
  }

  if (surface.key === "curriculum") {
    return route.kind === "curriculum-context" && route.sitemap ? null : locale;
  }

  return route.kind.startsWith("tryout-") ? null : locale;
});
