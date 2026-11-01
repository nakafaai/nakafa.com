import { compareSitemapPaths } from "@repo/backend/confect/contentRelease/sitemap";
import { Array as Arr, Effect } from "effect";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import { readPublishedQuranCatalog } from "@/lib/content/quran/publication";
import {
  readPublishedTryoutSitemap,
  readPublishedTryoutSitemapCount,
} from "@/lib/content/tryout/sitemap";
import { readSitemapDates, type SitemapDates } from "@/lib/sitemap/dates";
import { readFamilyPartition, routeToPath } from "@/lib/sitemap/family";
import {
  getSitemapPageDescriptor,
  isArticleSitemapPage,
  isMaterialSitemapPage,
  isPageSitemapPage,
  isProgramSitemapPage,
  isQuranSitemapPage,
  isTryoutSitemapPage,
  SitemapPageNotFoundError,
} from "@/lib/sitemap/identity";
import { pinSitemapRelease } from "@/lib/sitemap/pin";

const curriculaRoute = "/curricula";
const quranRootRoute = "/quran";
const tryoutRootRoute = "/try-out";

/** Static top-level routes in canonical lexical order. */
export const baseRoutes: readonly string[] = [
  "/",
  "/articles",
  "/contributor",
  curriculaRoute,
  "/pricing",
  quranRootRoute,
  "/search",
  tryoutRootRoute,
];

/** Dates routes by their snapshot family, and leaves them undated when it has no date. */
function dateRoutes<Route>(
  routes: readonly Route[],
  lastModified: string | null
) {
  return lastModified === null
    ? routes
    : Arr.map(routes, (route) => ({ ...route, lastModified }));
}

/**
 * The date of a base route that lists one snapshot family. The other base routes
 * are built with the code and hold no published content, so no date is true of them.
 */
function readBaseRouteDate(path: string, dates: SitemapDates) {
  if (path === curriculaRoute) {
    return dates.program;
  }
  if (path === tryoutRootRoute) {
    return dates.assessment;
  }
  return path === quranRootRoute ? dates.quran : null;
}

/** Reads the bounded routes and shared metadata for one sitemap page. */
export const readSitemapRoutePage = Effect.fn("www.sitemap.routePage")(
  function* (pageId: string) {
    const page = yield* Effect.fromOption(
      getSitemapPageDescriptor(pageId)
    ).pipe(Effect.mapError(() => new SitemapPageNotFoundError({ pageId })));

    if (isArticleSitemapPage(page) || isMaterialSitemapPage(page)) {
      return yield* readFamilyPartition(
        pageId,
        page.kind,
        page.locale,
        page.partition
      );
    }

    if (isProgramSitemapPage(page)) {
      const { routes } = yield* readFamilyPartition(
        pageId,
        page.kind,
        page.locale,
        page.partition
      );
      const { program } = yield* readSitemapDates();
      return { routes: dateRoutes(routes, program) };
    }

    if (isTryoutSitemapPage(page)) {
      const { missing, verify } = yield* pinSitemapRelease(pageId, page.locale);
      // The page number comes from the request, and only a page below the
      // count can exist, so no other number is ever read or stored.
      const { pageCount } = yield* readPublishedTryoutSitemapCount(page.locale);
      if (page.page >= pageCount) {
        return yield* missing;
      }
      const artifact = yield* readPublishedTryoutSitemap(
        page.locale,
        page.page
      );
      if (!artifact) {
        return yield* missing;
      }
      const artifactRoutes = Arr.map(artifact.paths, (publicPath) => ({
        path: routeToPath(publicPath),
      }));
      const { assessment } = yield* readSitemapDates();
      yield* verify;
      return {
        routes: dateRoutes(
          Arr.sortWith(
            artifactRoutes,
            (route) => route.path,
            compareSitemapPaths
          ),
          assessment
        ),
      };
    }

    if (isPageSitemapPage(page)) {
      const { missing, verify } = yield* pinSitemapRelease(pageId, page.locale);
      const catalog = yield* readPublishedPageCatalog();
      const projections = Arr.filter(
        catalog.projections,
        (projection) => projection.appLocale === page.locale
      );
      if (projections.length === 0) {
        return yield* missing;
      }
      const projectionRoutes = Arr.map(projections, (projection) => ({
        lastModified:
          projection.metadata.dateModified ?? projection.metadata.datePublished,
        path: routeToPath(projection.publicPath),
      }));
      const routes = Arr.sortWith(
        projectionRoutes,
        (route) => route.path,
        compareSitemapPaths
      );
      yield* verify;
      return {
        routes,
      };
    }

    if (isQuranSitemapPage(page)) {
      const { verify } = yield* pinSitemapRelease(pageId, page.locale);
      const { surahs } = yield* readPublishedQuranCatalog();
      const { quran } = yield* readSitemapDates();
      yield* verify;
      return {
        routes: dateRoutes(
          Arr.map(surahs, (surah) => ({
            path: `/quran/${surah.number}`,
          })),
          quran
        ),
      };
    }

    const dates = yield* readSitemapDates();
    return {
      routes: Arr.flatMap(baseRoutes, (path) =>
        dateRoutes([{ path }], readBaseRouteDate(path, dates))
      ),
    };
  }
);
