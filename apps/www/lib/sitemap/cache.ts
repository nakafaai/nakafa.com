import "server-only";

import { dangerouslyDeleteByTag } from "@vercel/functions";
import { Effect, Schema } from "effect";

/** One CDN-only tag shared by every bounded sitemap response. */
export const CONTENT_SITEMAP_CACHE_TAG = "content-sitemap";

/** Vercel could not remove the stale sitemap response from its CDN cache. */
export class SitemapCachePurgeError extends Schema.TaggedError<SitemapCachePurgeError>()(
  "SitemapCachePurgeError",
  {}
) {}

/** Deletes every sitemap response so the next crawler receives active content. */
export const purgeSitemapCache = Effect.fn("www.sitemap.cache.purge")(() =>
  Effect.tryPromise({
    catch: () => new SitemapCachePurgeError(),
    try: () =>
      dangerouslyDeleteByTag(CONTENT_SITEMAP_CACHE_TAG, {
        revalidationDeadlineSeconds: 0,
      }),
  })
);
