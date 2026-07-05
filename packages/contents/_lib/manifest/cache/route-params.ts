import { getStaticParamManifestFromParamManifest } from "@repo/contents/_lib/manifest/cache/extract";
import {
  contentRouteParamManifestCache,
  contentStaticParamManifestCache,
  getContentManifestCacheKey,
} from "@repo/contents/_lib/manifest/cache/store";
import type { ContentRouteParamManifest } from "@repo/contents/_lib/manifest/schema";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";

/** Returns the cached route-param manifest for one locale set. */
export function getContentRouteParamManifest(
  locales: readonly string[] = routing.locales
) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const manifest = yield* contentRouteParamManifestCache.get(
        getContentManifestCacheKey(locales)
      );

      yield* primeContentRouteParamManifestCaches(manifest, locales);

      return manifest;
    })
  );
}

/** Shares route-param results with the narrower static-param cache. */
function primeContentRouteParamManifestCaches(
  manifest: ContentRouteParamManifest,
  locales: readonly string[]
) {
  return contentStaticParamManifestCache.set(
    getContentManifestCacheKey(locales, manifest.version),
    getStaticParamManifestFromParamManifest(manifest)
  );
}
