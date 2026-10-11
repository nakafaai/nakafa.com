import "server-only";

import { invalidateByTag } from "@vercel/functions";
import { Effect, Schema } from "effect";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { readContentStore } from "@/lib/content/store/read";

/** One CDN-only tag shared by every bounded sitemap response. */
export const CONTENT_SITEMAP_CACHE_TAG = "content-sitemap";

/** Vercel could not mark the sitemap responses stale. */
export class SitemapCacheInvalidationError extends Schema.TaggedError<SitemapCacheInvalidationError>()(
  "SitemapCacheInvalidationError",
  {}
) {}

/** Proof, kept in the content store, that a release has purged the sitemap. */
const SitemapPurgeSchema = Schema.Struct({ purged: Schema.Literal(true) });

/** Applies the sitemap origin-cache dependency inside a `use cache` boundary.
 *
 * Entries carry only the shared sitemap tag, so every release purges
 * every sitemap entry through the single invalidation below. Family tags
 * would not narrow that scope, and mixing them with the hard expiry below
 * would leave stale-versus-expired semantics ambiguous. Entries keep the
 * long built-in profile on purpose because only a release purges them. */
export function applySitemapCache() {
  cacheTag(CONTENT_SITEMAP_CACHE_TAG);
  cacheLife("max");
}

/**
 * Expires every sitemap origin entry, then purges every sitemap CDN response.
 * The order matters: expiring the origin first guarantees the next edge miss
 * regenerates from the content store instead of re-caching a stale origin
 * value under the long CDN lifetime the responses advertise.
 *
 * Origin entries hard-expire on purpose instead of stale-marking. A
 * stale-marked origin would serve the previous sitemap to the first edge
 * miss after invalidation, and the edge would then cache that stale value
 * for another day with no second purge when the background refresh lands.
 * One blocking regeneration per sitemap document per release is the
 * cheaper price for always serving the current index.
 */
const purgeSitemapCache = Effect.fn("www.sitemap.cache.purge")(function* () {
  yield* Effect.try({
    catch: () => new SitemapCacheInvalidationError(),
    try: () => revalidateTag(CONTENT_SITEMAP_CACHE_TAG, { expire: 0 }),
  });
  yield* Effect.tryPromise({
    catch: () => new SitemapCacheInvalidationError(),
    try: () => invalidateByTag(CONTENT_SITEMAP_CACHE_TAG),
  });
  return SitemapPurgeSchema.make({ purged: true });
});

/**
 * Purges the sitemap once for each release. The publisher invalidates one
 * scope at a time, so a release arrives here once for every scope it changed,
 * yet its sitemap pages are the same for all of them: the purge is the loader
 * of a content store entry, so the first call of a release purges and the
 * later calls find the proof. A call that fails stores no proof, and the
 * publisher retries it. The caller names the release because it has just
 * proved it against Convex, while the stored pointer may still name the
 * previous release and would file the proof under the wrong one.
 */
export const invalidateSitemapCache = Effect.fn("www.sitemap.cache.invalidate")(
  function* (releaseId: ActiveContentReleaseId) {
    yield* readContentStore({
      kind: "sitemap.purge",
      load: purgeSitemapCache(),
      parts: [],
      release: releaseId,
      schema: SitemapPurgeSchema,
    });
  }
);
