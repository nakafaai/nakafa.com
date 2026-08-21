import {
  CONTENT_CACHE_GLOBAL_TAG,
  type ContentCacheTags,
  makeArtifactCacheTag,
  makeContentFamilyCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import { Effect, Schema } from "effect";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { purgeSitemapCache } from "@/lib/sitemap/cache";

const CONTENT_RUNTIME_CACHE_PROFILE = "contentRuntime";
const CONTENT_RUNTIME_REVALIDATION = { expire: 0 };
/** One content cache layer could not be invalidated after publication. */
export class ContentCacheInvalidationError extends Schema.TaggedError<ContentCacheInvalidationError>()(
  "ContentCacheInvalidationError",
  { layer: Schema.Literals(["next", "sitemap"]) }
) {}
/**
 * Applies the content runtime cache profile and invalidation tags to one cached read.
 */
export function applyContentRuntimeCache() {
  cacheTag(CONTENT_CACHE_GLOBAL_TAG);
  cacheLife(CONTENT_RUNTIME_CACHE_PROFILE);
}
/** Applies global and exact immutable snapshot tags to one published cache. */
export function applyPublishedSnapshotCache(snapshotId: Sha256Hash) {
  cacheTag(CONTENT_CACHE_GLOBAL_TAG, makeArtifactCacheTag(snapshotId));
  cacheLife(CONTENT_RUNTIME_CACHE_PROFILE);
}
/** Applies global and family tags to one published catalog cache. */
export function applyPublishedCatalogCache(family: ContentFamily) {
  cacheTag(CONTENT_CACHE_GLOBAL_TAG, makeContentFamilyCacheTag(family));
  cacheLife(CONTENT_RUNTIME_CACHE_PROFILE);
}
/** Applies global, family, and exact artifact tags to one published cache. */
export function applyPublishedContentCache(
  family: ContentFamily,
  artifactHash: Sha256Hash
) {
  cacheTag(
    CONTENT_CACHE_GLOBAL_TAG,
    makeContentFamilyCacheTag(family),
    makeArtifactCacheTag(artifactHash)
  );
  cacheLife(CONTENT_RUNTIME_CACHE_PROFILE);
}
/** Applies exact immutable artifact tags to one bounded published batch. */
export function applyPublishedContentBatchCache(
  family: ContentFamily,
  artifactHashes: readonly Sha256Hash[]
) {
  cacheTag(
    CONTENT_CACHE_GLOBAL_TAG,
    makeContentFamilyCacheTag(family),
    ...artifactHashes.map(makeArtifactCacheTag)
  );
  cacheLife(CONTENT_RUNTIME_CACHE_PROFILE);
}
/** Immediately invalidates Next runtime data and the sitemap CDN response. */
export const invalidateContentCache = Effect.fn("www.content.cache.invalidate")(
  function* (tags: ContentCacheTags) {
    yield* Effect.try({
      catch: () => new ContentCacheInvalidationError({ layer: "next" }),
      try: () => {
        for (const tag of tags) {
          revalidateTag(tag, CONTENT_RUNTIME_REVALIDATION);
        }
      },
    });
    yield* purgeSitemapCache().pipe(
      Effect.mapError(
        () => new ContentCacheInvalidationError({ layer: "sitemap" })
      )
    );
    return tags;
  }
);
