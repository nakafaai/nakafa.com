import { compareSitemapPaths } from "@repo/backend/confect/contentRelease/sitemap";
import { Array as Arr, Effect } from "effect";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import { readPublishedQuranCatalog } from "@/lib/content/quran/publication";
import {
  readPublishedTryoutSitemap,
  readPublishedTryoutSitemapCount,
} from "@/lib/content/tryout/sitemap";
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

const quranRootRoute = "/quran";

/** Static top-level routes in canonical lexical order. */
export const baseRoutes: readonly string[] = [
  "/",
  "/contributor",
  "/curricula",
  "/pricing",
  quranRootRoute,
  "/search",
];

/** Reads the bounded routes and shared metadata for one sitemap page. */
export const readSitemapRoutePage = Effect.fn("www.sitemap.routePage")(
  function* (pageId: string) {
    const page = getSitemapPageDescriptor(pageId);
    if (!page) {
      return yield* new SitemapPageNotFoundError({ pageId });
    }

    if (
      isArticleSitemapPage(page) ||
      isMaterialSitemapPage(page) ||
      isProgramSitemapPage(page)
    ) {
      return yield* readFamilyPartition(
        pageId,
        page.kind,
        page.locale,
        page.partition
      );
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
      yield* verify;
      return {
        routes: Arr.sortWith(
          artifactRoutes,
          (route) => route.path,
          compareSitemapPaths
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
      yield* verify;
      return {
        routes: Arr.map(surahs, (surah) => ({
          path: `/quran/${surah.number}`,
        })),
      };
    }

    return {
      routes: Arr.map(baseRoutes, (path) => ({ path })),
    };
  }
);
