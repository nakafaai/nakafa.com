import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  CONTENT_SITEMAP_ROUTE_PAGE_SIZE,
  compareSitemapPaths,
} from "@repo/backend/confect/contentRelease/sitemap";
import {
  loadTryoutCatalog,
  type PublishedCatalog,
} from "@repo/backend/content/tryout/catalog";
import { Array as Arr, Effect } from "effect";

/** Lists the public paths of one locale's catalog in sitemap order. */
function listTryoutSitemapPaths(catalog: PublishedCatalog) {
  return Arr.sort(
    Arr.flatMap(catalog.rows, ({ publicPath }) =>
      publicPath === undefined ? [] : [publicPath]
    ),
    compareSitemapPaths
  );
}

/** Reads the size of the sitemap of one locale of the active release. */
export const readTryoutSitemapCount = Effect.fn(
  "contentRelease.readTryoutSitemapCount"
)(function* (locale: AppLocaleCode) {
  const routeCount = listTryoutSitemapPaths(
    yield* loadTryoutCatalog(locale)
  ).length;
  return {
    pageCount: Math.ceil(routeCount / CONTENT_SITEMAP_ROUTE_PAGE_SIZE),
    routeCount,
  };
});

/** Reads one bounded page of the public try-out paths of one locale of the active release. */
export const readTryoutSitemapPage = Effect.fn(
  "contentRelease.readTryoutSitemapPage"
)(function* (locale: AppLocaleCode, page: number) {
  if (!Number.isSafeInteger(page) || page < 0) {
    return null;
  }
  const paths = listTryoutSitemapPaths(yield* loadTryoutCatalog(locale));
  const start = page * CONTENT_SITEMAP_ROUTE_PAGE_SIZE;
  if (start >= paths.length) {
    return null;
  }
  return {
    paths: Arr.take(Arr.drop(paths, start), CONTENT_SITEMAP_ROUTE_PAGE_SIZE),
  };
});
