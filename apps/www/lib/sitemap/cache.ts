import "server-only";

import {
  type ContentCacheScope,
  makeContentCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { invalidateByTag } from "@vercel/functions";
import { Effect, Schema } from "effect";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { CONTENT_CACHE_REVALIDATION } from "@/lib/content/profile";

/** One CDN-only tag shared by every bounded sitemap response. */
export const CONTENT_SITEMAP_CACHE_TAG = "content-sitemap";

/** Vercel could not mark the sitemap responses stale. */
export class SitemapCacheInvalidationError extends Schema.TaggedError<SitemapCacheInvalidationError>()(
  "SitemapCacheInvalidationError",
  {}
) {}

/** Applies sitemap origin-cache dependencies inside a `use cache` boundary.
 *
 * Entries keep the long built-in profile on purpose. The family tags below
 * are what a publication revalidates, so sitemap reads do not need the
 * hourly content revalidation the shared profile carries. */
export function applySitemapCache(...scopes: readonly ContentCacheScope[]) {
  cacheTag(CONTENT_SITEMAP_CACHE_TAG, ...scopes.map(makeContentCacheTag));
  cacheLife("max");
}

/**
 * Marks every sitemap response stale. The next crawler is served the previous
 * sitemap while a background revalidation refreshes it, which stays inside the
 * `stale-while-revalidate` window the response already advertises.
 *
 * Purges both the Next origin entries carrying the shared sitemap tag and the
 * Vercel CDN responses carrying the same tag value.
 */
export const invalidateSitemapCache = Effect.fn("www.sitemap.cache.invalidate")(
  function* () {
    yield* Effect.try({
      catch: () => new SitemapCacheInvalidationError(),
      try: () =>
        revalidateTag(CONTENT_SITEMAP_CACHE_TAG, CONTENT_CACHE_REVALIDATION),
    });
    yield* Effect.tryPromise({
      catch: () => new SitemapCacheInvalidationError(),
      try: () => invalidateByTag(CONTENT_SITEMAP_CACHE_TAG),
    });
  }
);
