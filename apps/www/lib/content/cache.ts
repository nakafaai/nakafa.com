import {
  type ContentCacheScope,
  makeContentCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { Array as Arr, Effect, Schema } from "effect";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import {
  CONTENT_CACHE_PROFILE,
  CONTENT_CACHE_REVALIDATION,
} from "@/lib/content/profile";

/** The Next data cache could not be invalidated after publication. */
export class ContentCacheInvalidationError extends Schema.TaggedError<ContentCacheInvalidationError>()(
  "ContentCacheInvalidationError",
  {}
) {}

/** Tags one cache entry with the mutable source dependencies it reads. */
function tagContentCache(
  scopes: readonly [ContentCacheScope, ...ContentCacheScope[]]
) {
  cacheTag(...Arr.map(scopes, makeContentCacheTag));
}

/** Applies only the mutable source dependencies actually read by this cache. */
export function applyContentCache(
  ...scopes: readonly [ContentCacheScope, ...ContentCacheScope[]]
) {
  tagContentCache(scopes);
  cacheLife(CONTENT_CACHE_PROFILE);
}

/**
 * Applies the scope tags to an entry whose key names the release it was read
 * for. A new release asks with a new key, so an hourly timer could only rewrite
 * an entry that nothing reads any more. The scope tag stays the way to expire
 * it.
 */
export function applyReleaseContentCache(
  ...scopes: readonly [ContentCacheScope, ...ContentCacheScope[]]
) {
  tagContentCache(scopes);
  cacheLife("max");
}

/** Invalidates one mutable dependency in the Next data cache. */
export const invalidateContentCache = Effect.fn("www.content.cache.invalidate")(
  function* (scope: ContentCacheScope) {
    yield* Effect.try({
      catch: () => new ContentCacheInvalidationError(),
      try: () =>
        revalidateTag(makeContentCacheTag(scope), CONTENT_CACHE_REVALIDATION),
    });
    return scope;
  }
);
