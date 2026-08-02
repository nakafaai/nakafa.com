import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import {
  CONTENT_SITEMAP_ROUTE_PAGE_SIZE,
  compareSitemapPaths,
} from "@repo/backend/convex/contents/sitemap/spec";
import { Effect } from "effect";

type TryoutCatalog = Effect.Effect.Success<
  ReturnType<typeof loadTryoutCatalog>
>;

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
)(function* (ctx: QueryCtx, locale: ContentLocale) {
  const catalog = yield* loadTryoutCatalog(ctx, locale);
  return {
    managed: catalog.managed,
    pageCount: Math.ceil(catalog.routeCount / CONTENT_SITEMAP_ROUTE_PAGE_SIZE),
    routeCount: catalog.routeCount,
  };
});

/** Reads one exact bounded page of verified public try-out paths. */
export const readTryoutSitemapPage = Effect.fn(
  "contentRelease.readTryoutSitemapPage"
)(function* (ctx: QueryCtx, locale: ContentLocale, page: number) {
  if (!Number.isSafeInteger(page) || page < 0) {
    return null;
  }

  const catalog = yield* loadTryoutCatalog(ctx, locale);
  if (!catalog.managed) {
    return null;
  }

  const paths = listTryoutSitemapPaths(catalog);
  const start = page * CONTENT_SITEMAP_ROUTE_PAGE_SIZE;
  if (start >= paths.length) {
    return null;
  }

  return {
    paths: paths.slice(start, start + CONTENT_SITEMAP_ROUTE_PAGE_SIZE),
  };
});
