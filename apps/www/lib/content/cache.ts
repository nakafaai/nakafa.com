import { MATERIAL_CACHE_TAGS } from "@nakafa/aksara-contracts/cache/material";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";

const CONTENT_RUNTIME_CACHE_PROFILE = "contentRuntime";
const CONTENT_RUNTIME_REVALIDATION = { expire: 0 };

/**
 * Applies the content runtime cache profile and invalidation tags to one cached read.
 */
export function applyContentRuntimeCache() {
  cacheTag(MATERIAL_CACHE_TAGS[0]);
  cacheLife(CONTENT_RUNTIME_CACHE_PROFILE);
}

/** Applies the exact shared material tags to one published-content cache. */
export function applyPublishedContentCache() {
  cacheTag(...MATERIAL_CACHE_TAGS);
  cacheLife(CONTENT_RUNTIME_CACHE_PROFILE);
}

/**
 * Immediately invalidates every cache owned by the published material runtime.
 */
export function revalidateMaterialCache() {
  for (const tag of MATERIAL_CACHE_TAGS) {
    revalidateTag(tag, CONTENT_RUNTIME_REVALIDATION);
  }

  return MATERIAL_CACHE_TAGS;
}
