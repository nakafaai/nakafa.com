import {
  type ContentCacheScope,
  makeArtifactCacheTag,
  makeContentCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
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

/** Applies only the mutable source dependencies actually read by this cache. */
export function applyContentCache(
  ...scopes: readonly [ContentCacheScope, ...ContentCacheScope[]]
) {
  cacheTag(...scopes.map(makeContentCacheTag));
  cacheLife(CONTENT_RUNTIME_CACHE_PROFILE);
}

/** Caches authenticated immutable bodies independently of active publication. */
export function applyImmutableContentCache(hashes: readonly Sha256Hash[]) {
  cacheTag(...hashes.map(makeArtifactCacheTag));
  cacheLife(CONTENT_RUNTIME_CACHE_PROFILE);
}

/** Invalidates one mutable dependency and the shared sitemap CDN response. */
export const invalidateContentCache = Effect.fn("www.content.cache.invalidate")(
  function* (scope: ContentCacheScope) {
    yield* Effect.try({
      catch: () => new ContentCacheInvalidationError({ layer: "next" }),
      try: () =>
        revalidateTag(makeContentCacheTag(scope), CONTENT_RUNTIME_REVALIDATION),
    });
    yield* purgeSitemapCache().pipe(
      Effect.mapError(
        () => new ContentCacheInvalidationError({ layer: "sitemap" })
      )
    );
    return scope;
  }
);
