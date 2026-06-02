import { buildContentRouteManifest } from "@repo/contents/_lib/manifest/build";
import { buildContentRouteParamManifest } from "@repo/contents/_lib/manifest/param-build";
import { buildContentPublicRouteManifest } from "@repo/contents/_lib/manifest/public-routes-build";
import { ContentRouteSource } from "@repo/contents/_lib/manifest/source";
import { buildContentStaticParamManifest } from "@repo/contents/_lib/manifest/static-build";
import { routing } from "@repo/internationalization/src/routing";
import { Cache, Duration, Effect } from "effect";

const cacheCapacity = 32;
const cacheKeySeparator = "\0";

/** Caches the full manifest behind a native Effect cache. */
export const contentRouteManifestCache = Effect.runSync(
  Cache.make({
    capacity: cacheCapacity,
    timeToLive: Duration.infinity,
    lookup: (cacheKey: string) =>
      buildContentRouteManifest(
        getLocalesFromContentManifestCacheKey(cacheKey)
      ).pipe(Effect.provide(ContentRouteSource.Default)),
  })
);

/** Caches route and indexing params behind a native Effect cache. */
export const contentRouteParamManifestCache = Effect.runSync(
  Cache.make({
    capacity: cacheCapacity,
    timeToLive: Duration.infinity,
    lookup: (cacheKey: string) =>
      buildContentRouteParamManifest(
        getLocalesFromContentManifestCacheKey(cacheKey)
      ).pipe(Effect.provide(ContentRouteSource.Default)),
  })
);

/** Caches public route data behind a native Effect cache. */
export const contentPublicRouteManifestCache = Effect.runSync(
  Cache.make({
    capacity: cacheCapacity,
    timeToLive: Duration.infinity,
    lookup: (cacheKey: string) =>
      buildContentPublicRouteManifest(
        getLocalesFromContentManifestCacheKey(cacheKey)
      ).pipe(Effect.provide(ContentRouteSource.Default)),
  })
);

/** Caches framework static params behind a native Effect cache. */
export const contentStaticParamManifestCache = Effect.runSync(
  Cache.make({
    capacity: cacheCapacity,
    timeToLive: Duration.infinity,
    lookup: (cacheKey: string) =>
      buildContentStaticParamManifest(
        getLocalesFromContentManifestCacheKey(cacheKey)
      ).pipe(Effect.provide(ContentRouteSource.Default)),
  })
);

/** Builds a stable versioned cache key from the active locale set. */
export function getContentManifestCacheKey(
  locales: readonly string[],
  version = getFolderCacheVersion()
) {
  return [String(version), ...locales].join(cacheKeySeparator);
}

/** Returns whether all requested locales are known routing locales. */
export function isRoutingLocaleSubset(locales: readonly string[]) {
  return locales.every((locale) =>
    routing.locales.some((routingLocale) => routingLocale === locale)
  );
}

/** Reads the folder cache version through the Effect source adapter. */
export function getFolderCacheVersion() {
  return Effect.runSync(
    ContentRouteSource.getFolderCacheVersion.pipe(
      Effect.provide(ContentRouteSource.Default)
    )
  );
}

/** Reads locales back from a versioned manifest cache key. */
function getLocalesFromContentManifestCacheKey(cacheKey: string) {
  const [, ...locales] = cacheKey.split(cacheKeySeparator);

  return locales;
}
