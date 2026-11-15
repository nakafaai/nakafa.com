import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  CONTENT_SITEMAP_ROUTE_PAGE_SIZE,
  compareSitemapPaths,
} from "@repo/backend/confect/contentRelease/sitemap";
import {
  loadTryoutCatalog,
  type PublishedCatalog,
} from "@repo/backend/content/tryout/catalog";
import {
  indexPublishedCatalog,
  isPublishedLanding,
} from "@repo/backend/content/tryout/hierarchy";
import { Array as Arr, Effect } from "effect";

/**
 * Lists the public paths of one locale's catalog in sitemap order. A row that a
 * link never lands on, an exam or a group with a single track, has no page of
 * its own (`isPublishedLanding`), so its path is not listed.
 */
export const listTryoutSitemapPaths = Effect.fn(
  "contentRelease.listTryoutSitemapPaths"
)(function* (catalog: PublishedCatalog) {
  const index = yield* indexPublishedCatalog(catalog);
  return Arr.sort(
    Arr.flatMap(catalog.rows, (row) => {
      if (row.publicPath === undefined) {
        return [];
      }
      if (
        (row.kind === "exam" || row.kind === "group") &&
        !isPublishedLanding(index, row)
      ) {
        return [];
      }
      return [row.publicPath];
    }),
    compareSitemapPaths
  );
});

/** Reads the size of the sitemap of one locale of the active release. */
export const readTryoutSitemapCount = Effect.fn(
  "contentRelease.readTryoutSitemapCount"
)(function* (locale: AppLocaleCode) {
  const routeCount = (yield* listTryoutSitemapPaths(
    yield* loadTryoutCatalog(locale)
  )).length;
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
  const paths = yield* listTryoutSitemapPaths(yield* loadTryoutCatalog(locale));
  const start = page * CONTENT_SITEMAP_ROUTE_PAGE_SIZE;
  if (start >= paths.length) {
    return null;
  }
  return {
    paths: Arr.take(Arr.drop(paths, start), CONTENT_SITEMAP_ROUTE_PAGE_SIZE),
  };
});
