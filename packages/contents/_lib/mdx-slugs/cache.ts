import {
  getMdxSlugsFromManifest,
  isMdxContentLocale,
  readMdxSlugManifest,
} from "@repo/contents/_lib/mdx-slugs/source";
import { Cache, Duration, Effect } from "effect";

const mdxSlugManifestCacheKey = "mdx-slug-manifest";

const mdxSlugManifestCache = Effect.runSync(
  Cache.make({
    capacity: 1,
    timeToLive: Duration.infinity,
    lookup: () => readMdxSlugManifest(),
  })
);

/** Clears cached MDX slug lookups for content refreshes and tests. */
export const clearMdxSlugCache = Effect.fn("contents.mdxSlugs.clearCache")(
  function* () {
    yield* mdxSlugManifestCache.invalidateAll;
  }
);

/** Returns all content-relative MDX slugs available for one locale. */
export const getMdxSlugsForLocale = Effect.fn("contents.mdxSlugs.getForLocale")(
  function* (locale: string) {
    if (!isMdxContentLocale(locale)) {
      return [];
    }

    const manifest = yield* mdxSlugManifestCache.get(mdxSlugManifestCacheKey);

    return getMdxSlugsFromManifest(manifest, locale);
  }
);
