import {
  CONTENT_CACHE_GLOBAL_TAG,
  type ContentCacheTags,
  makeArtifactCacheTag,
  makeContentFamilyCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";

const CONTENT_RUNTIME_CACHE_PROFILE = "contentRuntime";
const CONTENT_RUNTIME_REVALIDATION = { expire: 0 };

/**
 * Applies the content runtime cache profile and invalidation tags to one cached read.
 */
export function applyContentRuntimeCache() {
  cacheTag(CONTENT_CACHE_GLOBAL_TAG);
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

/** Immediately invalidates one exact decoded content-family cache request. */
export function revalidateContentCache(tags: ContentCacheTags) {
  for (const tag of tags) {
    revalidateTag(tag, CONTENT_RUNTIME_REVALIDATION);
  }

  return tags;
}
