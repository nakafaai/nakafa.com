import { compareSitemapPaths } from "@repo/backend/convex/contentRelease/sitemap";
import { Data, Effect } from "effect";
import { readPublishedArticleSitemap } from "@/lib/content/article/sitemap";
import { readPublishedMaterialSitemap } from "@/lib/content/material/sitemap";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import { readPublishedProgramSitemap } from "@/lib/content/program/sitemap";
import { readPublishedQuranCatalog } from "@/lib/content/quran/publication";
import { readPublishedTryoutSitemap } from "@/lib/content/tryout/sitemap";
import {
  getSitemapPageDescriptor,
  isArticleSitemapPage,
  isMaterialSitemapPage,
  isPageSitemapPage,
  isProgramSitemapPage,
  isQuranSitemapPage,
  isTryoutSitemapPage,
} from "@/lib/sitemap/identity";

const quranRootRoute = "/quran";

/** A canonical sitemap page id whose route page does not exist. */
export class SitemapPageNotFoundError extends Data.TaggedError(
  "SitemapPageNotFoundError"
)<{
  readonly pageId: string;
}> {}

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

    if (isArticleSitemapPage(page)) {
      const artifact = yield* readPublishedArticleSitemap(
        page.locale,
        page.bucket
      );
      if (!artifact) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      return {
        routes: artifact.routes
          .map((route) => ({
            ...("lastModified" in route
              ? { lastModified: route.lastModified }
              : {}),
            path: routeToPath(route.publicPath),
          }))
          .sort((left, right) => compareSitemapPaths(left.path, right.path)),
      };
    }
    if (isMaterialSitemapPage(page)) {
      const artifact = yield* readPublishedMaterialSitemap(
        page.locale,
        page.bucket
      );
      if (!artifact) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      return {
        routes: artifact.routes
          .map(({ lastModified, publicPath }) => ({
            lastModified,
            path: routeToPath(publicPath),
          }))
          .sort((left, right) => compareSitemapPaths(left.path, right.path)),
      };
    }
    if (isProgramSitemapPage(page)) {
      const artifact = yield* readPublishedProgramSitemap(
        page.locale,
        page.bucket
      );
      if (!artifact) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      return {
        routes: artifact.routes
          .map(({ publicPath }) => ({ path: routeToPath(publicPath) }))
          .sort((left, right) => compareSitemapPaths(left.path, right.path)),
      };
    }

    if (isTryoutSitemapPage(page)) {
      const artifact = yield* readPublishedTryoutSitemap(
        page.locale,
        page.page
      );
      if (!artifact) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      return {
        routes: artifact.paths
          .map((publicPath) => ({ path: routeToPath(publicPath) }))
          .sort((left, right) => compareSitemapPaths(left.path, right.path)),
      };
    }

    if (isPageSitemapPage(page)) {
      const catalog = yield* readPublishedPageCatalog();
      const projections = catalog.projections.filter(
        (projection) => projection.appLocale === page.locale
      );
      if (projections.length === 0) {
        return yield* new SitemapPageNotFoundError({ pageId });
      }
      const routes = projections.map((projection) => ({
        lastModified: projection.metadata.lastModified,
        path: routeToPath(projection.publicPath),
      }));
      routes.sort((left, right) => compareSitemapPaths(left.path, right.path));
      return {
        routes,
      };
    }

    if (isQuranSitemapPage(page)) {
      const { surahs } = yield* readPublishedQuranCatalog();
      return {
        routes: surahs.map((surah) => ({
          path: `/quran/${surah.number}`,
        })),
      };
    }

    return {
      routes: baseRoutes.map((path) => ({ path })),
    };
  }
);

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}
