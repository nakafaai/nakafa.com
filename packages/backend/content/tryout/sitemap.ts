import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import {
  CONTENT_SITEMAP_ROUTE_PAGE_SIZE,
  compareSitemapPaths,
} from "@repo/backend/convex/contentRelease/sitemap";
import { Effect } from "effect";

type TryoutCatalog = Effect.Success<ReturnType<typeof loadTryoutCatalog>>;
/** Selects canonical public paths from one verified localized catalog. */
function listTryoutSitemapPaths(catalog: TryoutCatalog) {
  const paths: string[] = [];
  for (const { row } of catalog.entries) {
    if (row.publicPath !== undefined) {
      paths.push(row.publicPath);
    }
  }
  return paths.sort(compareSitemapPaths);
}
/** Reads the bounded sitemap inventory for one active try-out locale. */
export const readTryoutSitemapCount = Effect.fn(
  "contentRelease.readTryoutSitemapCount"
)(function* (locale: AppLocaleCode) {
  const catalog = yield* loadTryoutCatalog(locale);
  return {
    pageCount: Math.ceil(catalog.routeCount / CONTENT_SITEMAP_ROUTE_PAGE_SIZE),
    routeCount: catalog.routeCount,
  };
});
/** Reads one exact bounded page of verified public try-out paths. */
export const readTryoutSitemapPage = Effect.fn(
  "contentRelease.readTryoutSitemapPage"
)(function* (locale: AppLocaleCode, page: number) {
  if (!Number.isSafeInteger(page) || page < 0) {
    return null;
  }
  const catalog = yield* loadTryoutCatalog(locale);
  const paths = listTryoutSitemapPaths(catalog);
  const start = page * CONTENT_SITEMAP_ROUTE_PAGE_SIZE;
  if (start >= paths.length) {
    return null;
  }
  return {
    paths: paths.slice(start, start + CONTENT_SITEMAP_ROUTE_PAGE_SIZE),
  };
});
