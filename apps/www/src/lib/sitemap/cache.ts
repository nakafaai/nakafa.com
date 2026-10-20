import "@tanstack/react-start/server-only";

import { invalidateByTag } from "@vercel/functions";
import { Effect, Schema } from "effect";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { expireStoreTag } from "@/lib/content/store/entry";
import { purgeOncePerRelease } from "@/lib/content/store/purge";

/** One CDN-only tag shared by every bounded sitemap response. */
export const CONTENT_SITEMAP_CACHE_TAG = "content-sitemap";

/** Vercel could not mark the sitemap responses stale. */
export class SitemapCacheInvalidationError extends Schema.TaggedError<SitemapCacheInvalidationError>()(
  "SitemapCacheInvalidationError",
  {}
) {}

/**
 * Expires every sitemap store entry, then purges every sitemap CDN response.
 * The order matters: expiring the store first guarantees the next edge miss
 * regenerates from the content store instead of re-caching a stale value
 * under the long CDN lifetime the responses advertise.
 *
 * Store entries hard-expire on purpose instead of stale-marking. A
 * stale-marked entry would serve the previous sitemap to the first edge miss
 * after invalidation, and the edge would then cache that stale value for
 * another day with no second purge when the background refresh lands. One
 * blocking regeneration per sitemap document per release is the cheaper price
 * for always serving the current index.
 */
const purgeSitemapCache = Effect.fn("www.sitemap.cache.purge")(function* () {
  yield* expireStoreTag(CONTENT_SITEMAP_CACHE_TAG).pipe(
    Effect.mapError(() => new SitemapCacheInvalidationError())
  );
  yield* Effect.tryPromise({
    catch: () => new SitemapCacheInvalidationError(),
    try: () => invalidateByTag(CONTENT_SITEMAP_CACHE_TAG),
  });
});

/**
 * Purges the sitemap once for each release, however many scopes the release
 * changes, because its sitemap pages are the same for all of them.
 */
export const invalidateSitemapCache = Effect.fn("www.sitemap.cache.invalidate")(
  function* (releaseId: ActiveContentReleaseId) {
    yield* purgeOncePerRelease({
      kind: "sitemap.purge",
      purge: purgeSitemapCache(),
      releaseId,
    });
  }
);
