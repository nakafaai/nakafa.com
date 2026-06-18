import { getPublicContentRouteCheck } from "@repo/contents/_lib/manifest/public-route";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { listPublicAssessmentRoutes } from "@repo/contents/_types/route/assessment";
import {
  isMaterialLessonRoute,
  isPracticeSetRoute,
  listPublicContentRoutes,
} from "@repo/contents/_types/route/content";
import {
  isRenderableCurriculumRoute,
  listPublicCurriculumRoutes,
} from "@repo/contents/_types/route/curriculum";
import { readPublicPracticeQuestionRouteByPath } from "@repo/contents/_types/route/practice";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { hasLocale } from "next-intl";
import { getRuntimeContentRoute } from "@/lib/content/runtime/routes";

const REJECTED_PUBLIC_ROOTS = new Set(["/learn"]);
const PROJECTED_ROUTE_SURFACE_KEYS = new Set([
  "assessment",
  "curriculum",
  "exercises",
  "subject",
]);
const QURAN_SURAH_COUNT = 114;

/**
 * Reads route rejections that must run before markdown negotiation.
 *
 * Wrong public namespaces and finite source-backed HTML routes should return a
 * real 404, but markdown requests still need a chance to route through the
 * agent-readable source handler before projected route membership is checked.
 */
export const readSourceBackedHtmlRouteRejection = Effect.fn(
  "www.routing.publicHtml.sourceRejection"
)(function* ({ method, pathname }: { method: string; pathname: string }) {
  const rejectedPublicRouteLocale = readRejectedPublicRouteLocale(pathname);

  if (rejectedPublicRouteLocale) {
    return rejectedPublicRouteLocale;
  }

  return yield* readMissingHtmlContentLocale({ method, pathname });
});

/**
 * Reads source-projected HTML routes that should not stream soft 404s.
 *
 * Cache Components remove `dynamicParams`, so the framework adapter calls this
 * after markdown negotiation to reject non-rendered grouping rows with HTTP 404
 * while preserving virtual practice question pages.
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

  const publicPath = [namespace, ...pathSegments].join("/");

  if (
    surface.key === "exercises" &&
    isRenderablePracticeQuestionPath({ locale, publicPath })
  ) {
    return null;
  }

  const renderableProjectedHtmlPaths =
    yield* readRenderableProjectedHtmlPathSet();

  return renderableProjectedHtmlPaths.has(`${locale}:${publicPath}`)
    ? null
    : locale;
});

/**
 * Materializes the route projection rows that can render HTML without streaming
 * a soft-not-found response. The proxy reads this immutable set at request time
 * instead of importing curriculum, assessment, and material source registries.
 */
function readRenderableProjectedHtmlPathSet() {
  return Effect.gen(function* () {
    const [contentRoutes, curriculumRoutes, assessmentRoutes] =
      yield* Effect.all([
        listPublicContentRoutes(),
        listPublicCurriculumRoutes(),
        listPublicAssessmentRoutes(),
      ]);
    const routeKeys = new Set<string>();

    for (const route of contentRoutes) {
      if (route.kind === "subject-lesson" && isMaterialLessonRoute(route)) {
        routeKeys.add(`${route.locale}:${route.publicPath}`);
        continue;
      }

      if (isPracticeSetRoute(route)) {
        routeKeys.add(`${route.locale}:${route.publicPath}`);
        routeKeys.add(
          `${route.locale}:${route.publicPath
            .split("/")
            .slice(0, -1)
            .join("/")}`
        );
      }
    }

    for (const route of curriculumRoutes) {
      if (isRenderableCurriculumRoute(route)) {
        routeKeys.add(`${route.locale}:${route.publicPath}`);
      }
    }

    for (const route of assessmentRoutes) {
      routeKeys.add(`${route.locale}:${route.publicPath}`);
    }

    return routeKeys;
  });
}

/**
 * Checks virtual practice question routes that are not part of static params.
 *
 * Practice question pages are derived from their canonical set source row, so
 * direct URLs need a source-owned lookup instead of a static route row.
 */
function isRenderablePracticeQuestionPath({
  locale,
  publicPath,
}: {
  locale: (typeof routing.locales)[number];
  publicPath: string;
}) {
  return Boolean(
    readPublicPracticeQuestionRouteByPath({
      domains: MATERIAL_ROUTE_DOMAINS,
      locale,
      materials: MATERIAL_SOURCES,
      publicPath,
    })
  );
}

/** Narrows public surfaces to projected app routes managed by this Module. */
function isProjectedRouteSurface(key: string) {
  return PROJECTED_ROUTE_SURFACE_KEYS.has(key);
}

/**
 * Rejects known public-route namespaces when a request uses a stale slug.
 *
 * This is a clean cutover check: known non-canonical namespaces become 404s
 * instead of being treated as localized pages or redirects.
 */
function readRejectedPublicRouteLocale(pathname: string) {
  if (REJECTED_PUBLIC_ROOTS.has(pathname)) {
    return routing.defaultLocale;
  }

  const [locale, namespace] = pathname.split("/").filter(Boolean);

  if (!(namespace && hasLocale(routing.locales, locale))) {
    return null;
  }

  const usesRejectedNamespace = PUBLIC_ROUTE_SURFACES.some((surface) => {
    const expectedNamespace = surface.routeSlugs[locale];
    const knownNamespaces = [
      surface.appSegment,
      surface.key,
      ...Object.values(surface.routeSlugs),
    ];

    return (
      namespace !== expectedNamespace &&
      knownNamespaces.some((knownNamespace) => knownNamespace === namespace)
    );
  });

  return usesRejectedNamespace ? locale : null;
}

/**
 * Reads finite source-backed HTML routes that should 404 before app rendering.
 *
 * Quran and article detail pages have finite source inventories. Rejecting
 * impossible shapes here prevents Next streamed not-found responses from
 * looking like successful soft 404s to agents and crawlers.
 */
function readMissingHtmlContentLocale({
  method,
  pathname,
}: {
  method: string;
  pathname: string;
}) {
  if (!(method === "GET" || method === "HEAD")) {
    return Effect.succeed(null);
  }

  const [locale, root, ...segments] = pathname.split("/").filter(Boolean);

  if (!(root && hasLocale(routing.locales, locale))) {
    return Effect.succeed(null);
  }

  if (root === "quran") {
    return Effect.succeed(isRenderableQuranPath(segments) ? null : locale);
  }

  if (root !== "articles") {
    return Effect.succeed(null);
  }

  return readMissingArticleHtmlLocale({
    locale,
    segments,
  });
}

/** Checks whether one Quran route path can be rendered by the source corpus. */
function isRenderableQuranPath(segments: readonly string[]) {
  if (segments.length === 0) {
    return true;
  }

  if (segments.length !== 1) {
    return false;
  }

  const surah = segments.join("");
  const surahNumber = Number.parseInt(surah, 10);

  return (
    Number.isSafeInteger(surahNumber) &&
    `${surahNumber}` === surah &&
    surahNumber >= 1 &&
    surahNumber <= QURAN_SURAH_COUNT
  );
}

/** Verifies article detail paths against the runtime content route catalog. */
function readMissingArticleHtmlLocale({
  locale,
  segments,
}: {
  locale: (typeof routing.locales)[number];
  segments: readonly string[];
}) {
  if (segments.length === 0) {
    return Effect.succeed(null);
  }

  const route = ["articles", ...segments].join("/");
  const routeCheck = getPublicContentRouteCheck(route);

  if (routeCheck.mode === "article-category") {
    return Effect.succeed(null);
  }

  if (routeCheck.mode !== "exact") {
    return Effect.succeed(locale);
  }

  if (segments.length !== 2) {
    return Effect.succeed(locale);
  }

  return getRuntimeContentRoute({ locale, route }).pipe(
    Effect.match({
      onFailure: () => locale,
      onSuccess: (contentRoute) => (contentRoute ? null : locale),
    })
  );
}
