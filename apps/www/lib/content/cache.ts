import {
  type ContentCacheScope,
  makeContentCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { Effect, Schema } from "effect";
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
  cacheTag(...scopes.map(makeContentCacheTag));
  cacheLife(CONTENT_CACHE_PROFILE);
}

/** Invalidates one mutable dependency and the shared sitemap CDN response. */
export const invalidateContentCache = Effect.fn("www.content.cache.invalidate")(
  function* (scope: ContentCacheScope) {
    yield* Effect.try({
      catch: () => new ContentCacheInvalidationError({ layer: "next" }),
      try: () =>
        revalidateTag(makeContentCacheTag(scope), CONTENT_CACHE_REVALIDATION),
    });
    yield* invalidateSitemapCache().pipe(
      Effect.mapError(
        () => new ContentCacheInvalidationError({ layer: "sitemap" })
      )
    );
    return scope;
  }
);
