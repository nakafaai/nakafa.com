import {
  contentStaticParamManifestCache,
  getContentManifestCacheKey,
  isRoutingLocaleSubset,
} from "@repo/contents/_lib/manifest/cache/store";
import { filterParamsByLocales } from "@repo/contents/_lib/manifest/params";
import type { ContentRoot } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";

/** Returns the cached static-param manifest for framework route adapters. */
export function getContentStaticParamManifest(
  locales: readonly string[] = routing.locales
) {
  return Effect.runPromise(
    contentStaticParamManifestCache.get(getContentManifestCacheKey(locales))
  );
}

/** Returns static params for one content root. */
export function getContentStaticParams({
  basePath,
  locales = routing.locales,
}: {
  basePath: ContentRoot;
  locales?: readonly string[];
}) {
  return Effect.runPromise(
    Effect.map(getContentStaticParamManifestForParams(locales), (manifest) =>
      filterParamsByLocales(manifest.staticParams[basePath], locales)
    )
  );
}

/** Returns locale-aware params for route groups that expose locale separately. */
export function getContentLocaleParams({
  locales = routing.locales,
}: {
  locales?: readonly string[];
} = {}) {
  return Effect.runPromise(
    Effect.map(getContentStaticParamManifestForParams(locales), (manifest) =>
      filterParamsByLocales(manifest.localeParams, locales)
    )
  );
}

/** Returns the static-param cache source used by locale-filterable adapters. */
function getContentStaticParamManifestForParams(locales: readonly string[]) {
  if (isRoutingLocaleSubset(locales)) {
    return contentStaticParamManifestCache.get(
      getContentManifestCacheKey(routing.locales)
    );
  }

  return contentStaticParamManifestCache.get(
    getContentManifestCacheKey(locales)
  );
}
