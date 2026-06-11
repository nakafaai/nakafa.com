import { cacheLife, cacheTag, revalidateTag } from "next/cache";

export const CONTENT_RUNTIME_CACHE_PROFILE = "contentRuntime";
export const CONTENT_RUNTIME_CACHE_TAG = "content-runtime";

const CONTENT_RUNTIME_REVALIDATION = { expire: 0 };

/**
 * Returns the cache tags shared by Convex-backed content runtime reads.
 */
export function getContentRuntimeCacheTags() {
  return [CONTENT_RUNTIME_CACHE_TAG];
}

/**
 * Applies the content runtime cache profile and invalidation tags to one cached read.
 */
export function applyContentRuntimeCache() {
  for (const tag of getContentRuntimeCacheTags()) {
    cacheTag(tag);
  }

  cacheLife(CONTENT_RUNTIME_CACHE_PROFILE);
}

/**
 * Immediately invalidates the content runtime cache after the Convex read model is synced.
 */
export function revalidateContentRuntimeCache() {
  for (const tag of getContentRuntimeCacheTags()) {
    revalidateTag(tag, CONTENT_RUNTIME_REVALIDATION);
  }

  return getContentRuntimeCacheTags();
}
