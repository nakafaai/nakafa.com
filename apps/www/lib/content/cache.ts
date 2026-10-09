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
import { invalidateSitemapCache } from "@/lib/sitemap/cache";

/** One content cache layer could not be invalidated after publication. */
export class ContentCacheInvalidationError extends Schema.TaggedError<ContentCacheInvalidationError>()(
  "ContentCacheInvalidationError",
  { layer: Schema.Literals(["next", "sitemap"]) }
) {}

/** Applies only the mutable source dependencies actually read by this cache. */
export function applyContentCache(
  ...scopes: readonly [ContentCacheScope, ...ContentCacheScope[]]
) {
  cacheTag(...Arr.map(scopes, makeContentCacheTag));
  cacheLife(CONTENT_CACHE_PROFILE);
}

/** Invalidates one mutable dependency and the shared sitemap CDN response. */
export const invalidateContentCache = Effect.fn("www.content.cache.invalidate")(
  function* (scope: ContentCacheScope) {
    yield* Effect.try({
      catch: () => ContentCacheInvalidationError.make({ layer: "next" }),
      try: () =>
        revalidateTag(makeContentCacheTag(scope), CONTENT_CACHE_REVALIDATION),
    });
    yield* invalidateSitemapCache().pipe(
      Effect.mapError(() =>
        ContentCacheInvalidationError.make({ layer: "sitemap" })
      )
    );
    return scope;
  }
);
