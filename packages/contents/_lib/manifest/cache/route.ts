import {
  getParamManifestFromRouteManifest,
  getPublicRouteManifestFromRouteManifest,
  getStaticParamManifestFromRouteManifest,
} from "@repo/contents/_lib/manifest/cache/extract";
import {
  contentPublicRouteManifestCache,
  contentRouteManifestCache,
  contentRouteParamManifestCache,
  contentStaticParamManifestCache,
  getContentManifestCacheKey,
} from "@repo/contents/_lib/manifest/cache/store";
import type { ContentRouteManifest } from "@repo/contents/_lib/manifest/schema";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";

/** Returns the cached content route manifest for one locale set. */
export function getContentRouteManifest(
  locales: readonly string[] = routing.locales
) {
  const manifest = Effect.runSync(
    contentRouteManifestCache.get(getContentManifestCacheKey(locales))
  );

  primeContentRouteManifestCaches(manifest, locales);

  return manifest;
}

/** Shares full-manifest results with narrower native Effect caches. */
function primeContentRouteManifestCaches(
  manifest: ContentRouteManifest,
  locales: readonly string[]
) {
  const cacheKey = getContentManifestCacheKey(locales, manifest.version);

  Effect.runSync(
    Effect.all(
      [
        contentRouteParamManifestCache.set(
          cacheKey,
          getParamManifestFromRouteManifest(manifest)
        ),
        contentStaticParamManifestCache.set(
          cacheKey,
          getStaticParamManifestFromRouteManifest(manifest)
        ),
        contentPublicRouteManifestCache.set(
          cacheKey,
          getPublicRouteManifestFromRouteManifest(manifest)
        ),
      ],
      { discard: true }
    )
  );
}
