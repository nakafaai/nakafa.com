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

/**
 * Applies only the mutable source dependencies actually read by this cache, and
 * the hourly lifetime that bounds how long the entry can be stale.
 *
 * The default `use cache` handler keeps its entries, and the record of the tags
 * that were revalidated, in the memory of one process, and the activation route
 * revalidates a tag in one instance only. Every other instance keeps an entry
 * until its lifetime ends, so the lifetime is what carries a release to them.
 * Reading through the content store does not change that: the store answers
 * for a release only when it is asked, and an entry of this kind is asked once
 * an hour. An entry whose key names the release does not need the lifetime; see
 * `applyReleaseContentCache`, and `profile.ts` for the other entries that go
 * without it.
 */
export function applyContentCache(
  ...scopes: readonly [ContentCacheScope, ...ContentCacheScope[]]
) {
  tagContentCache(scopes);
  cacheLife(CONTENT_CACHE_PROFILE);
}

/**
 * Applies the scope tags to an entry whose key names the release it was read
 * for. A new release asks with a new key, in every instance and without a tag
 * reaching it, so an hourly timer could only rewrite an entry that nothing reads
 * any more. The scope tag stays the way to expire it.
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
