import { getStaticParamManifestFromParamManifest } from "@repo/contents/_lib/manifest/cache/extract";
import {
  contentRouteParamManifestCache,
  contentStaticParamManifestCache,
  getContentManifestCacheKey,
  isRoutingLocaleSubset,
} from "@repo/contents/_lib/manifest/cache/store";
import { filterParamsByLocales } from "@repo/contents/_lib/manifest/params";
import type { ContentRouteParamManifest } from "@repo/contents/_lib/manifest/schema";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";

/** Returns the cached param and indexing manifest for one locale set. */
export function getContentRouteParamManifest(
  locales: readonly string[] = routing.locales
) {
  const manifest = Effect.runSync(
    contentRouteParamManifestCache.get(getContentManifestCacheKey(locales))
  );

  primeContentRouteParamManifestCaches(manifest, locales);

  return manifest;
}

/** Returns concrete exercise API params for set and question endpoints. */
export function getExerciseApiParamsForLocales(
  locales: readonly string[] = routing.locales
) {
  return filterParamsByLocales(
    getContentRouteParamManifestForParams(locales).exerciseApiParams,
    locales
  );
}

/** Returns Pagefind source entries from the cached param manifest. */
export function getContentIndexManifest(
  locales: readonly string[] = routing.locales
) {
  return getContentRouteParamManifestForParams(locales);
}

/** Shares route-param results with the narrower static-param cache. */
function primeContentRouteParamManifestCaches(
  manifest: ContentRouteParamManifest,
  locales: readonly string[]
) {
  Effect.runSync(
    contentStaticParamManifestCache.set(
      getContentManifestCacheKey(locales, manifest.version),
      getStaticParamManifestFromParamManifest(manifest)
    )
  );
}

/** Returns the param cache source used by locale-filterable adapters. */
function getContentRouteParamManifestForParams(locales: readonly string[]) {
  if (isRoutingLocaleSubset(locales)) {
    return getContentRouteParamManifest();
  }

  return getContentRouteParamManifest(locales);
}
