import {
  isMaterialLessonRoute,
  listPublicContentRoutes,
} from "@repo/contents/_types/route/content";
import {
  isRenderableCurriculumRoute,
  listPublicCurriculumRoutes,
} from "@repo/contents/_types/route/curriculum";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { listPublicTryoutRoutes } from "@repo/contents/_types/route/tryout";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { hasLocale } from "next-intl";

const PROJECTED_ROUTE_SURFACE_KEYS = new Set([
  "curriculum",
  "subject",
  "tryout",
]);

/**
 * Reads source-projected HTML routes that should not stream soft 404s.
 *
 * Cache Components remove `dynamicParams`, so the framework adapter calls this
 * after markdown negotiation to reject non-rendered grouping rows with HTTP 404
 * while preserving source-backed markdown negotiation.
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
    (item) =>
      isProjectedRouteSurface(item.key) && item.routeSlugs[locale] === namespace
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

  const renderableProjectedHtmlPaths =
    yield* readRenderableProjectedHtmlPathSet();

  return renderableProjectedHtmlPaths.has(`${locale}:${publicPath}`)
    ? null
    : locale;
});

/**
 * Materializes the route projection rows that can render HTML without streaming
 * a soft-not-found response. The proxy reads this immutable set at request time
 * instead of importing curriculum and material source registries.
 */
function readRenderableProjectedHtmlPathSet() {
  return Effect.gen(function* () {
    const [contentRoutes, curriculumRoutes, tryoutRoutes] = yield* Effect.all([
      listPublicContentRoutes(),
      listPublicCurriculumRoutes(),
      listPublicTryoutRoutes(),
    ]);
    const routeKeys = new Set<string>();

    for (const route of contentRoutes) {
      if (route.kind === "subject-lesson" && isMaterialLessonRoute(route)) {
        routeKeys.add(`${route.locale}:${route.publicPath}`);
      }
    }

    for (const route of curriculumRoutes) {
      if (isRenderableCurriculumRoute(route)) {
        routeKeys.add(`${route.locale}:${route.publicPath}`);
      }
    }

    for (const route of tryoutRoutes) {
      routeKeys.add(`${route.locale}:${route.publicPath}`);
    }

    return routeKeys;
  });
}

/** Narrows public surfaces to projected app routes managed by this Module. */
function isProjectedRouteSurface(key: string) {
  return PROJECTED_ROUTE_SURFACE_KEYS.has(key);
}
