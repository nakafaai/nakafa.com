import "server-only";

import { invalidateByTag } from "@vercel/functions";
import { Effect, Schema } from "effect";

/** One CDN-only tag shared by every bounded sitemap response. */
export const CONTENT_SITEMAP_CACHE_TAG = "content-sitemap";

/** Vercel could not mark the sitemap responses stale. */
export class SitemapCacheInvalidationError extends Schema.TaggedError<SitemapCacheInvalidationError>()(
  "SitemapCacheInvalidationError",
  {}
) {}

/**
 * Marks every sitemap response stale. The next crawler is served the previous
 * sitemap while a background revalidation refreshes it, which stays inside the
 * `stale-while-revalidate` window the response already advertises.
 */
export const invalidateSitemapCache = Effect.fn("www.sitemap.cache.invalidate")(
  () =>
    Effect.tryPromise({
      catch: () => new SitemapCacheInvalidationError(),
      try: () => invalidateByTag(CONTENT_SITEMAP_CACHE_TAG),
    })
);
