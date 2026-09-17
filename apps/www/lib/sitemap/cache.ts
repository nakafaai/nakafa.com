import "server-only";

import { invalidateByTag } from "@vercel/functions";
import { Effect, Schema } from "effect";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";

/** One CDN-only tag shared by every bounded sitemap response. */
export const CONTENT_SITEMAP_CACHE_TAG = "content-sitemap";

/** Vercel could not mark the sitemap responses stale. */
export class SitemapCacheInvalidationError extends Schema.TaggedError<SitemapCacheInvalidationError>()(
  "SitemapCacheInvalidationError",
  {}
) {}

/** Applies the sitemap origin-cache dependency inside a `use cache` boundary.
 *
 * Entries carry only the shared sitemap tag, so every publication purges
 * every sitemap entry through the single invalidation below. Family tags
 * would not narrow that scope, and mixing them with the hard expiry below
 * would leave stale-versus-expired semantics ambiguous. Entries keep the
 * long built-in profile on purpose because only publication purges them. */
export function applySitemapCache() {
  cacheTag(CONTENT_SITEMAP_CACHE_TAG);
  cacheLife("max");
}

/**
 * Expires every sitemap origin entry, then purges every sitemap CDN response.
 * The order matters: expiring the origin first guarantees the next edge miss
 * regenerates from fresh Convex reads instead of re-caching a stale origin
 * value under the long CDN lifetime the responses advertise.
 *
 * Origin entries hard-expire on purpose instead of stale-marking. A
 * stale-marked origin would serve the previous sitemap to the first edge
 * miss after invalidation, and the edge would then cache that stale value
 * for another day with no second purge when the background refresh lands.
 * One blocking regeneration per sitemap document per publication is the
 * cheaper price for always serving the current index.
 */
export const invalidateSitemapCache = Effect.fn("www.sitemap.cache.invalidate")(
  function* () {
    yield* Effect.try({
      catch: () => new SitemapCacheInvalidationError(),
      try: () => revalidateTag(CONTENT_SITEMAP_CACHE_TAG, { expire: 0 }),
    });
    yield* Effect.tryPromise({
      catch: () => new SitemapCacheInvalidationError(),
      try: () => invalidateByTag(CONTENT_SITEMAP_CACHE_TAG),
    });
  }
);
