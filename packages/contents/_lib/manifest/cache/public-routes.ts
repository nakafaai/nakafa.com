import {
  contentPublicRouteManifestCache,
  getContentManifestCacheKey,
} from "@repo/contents/_lib/manifest/cache/store";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";

/** Returns the cached public route manifest for sitemap and proxy adapters. */
export function getContentPublicRouteManifest(
  locales: readonly string[] = routing.locales
) {
  return Effect.runPromise(
    contentPublicRouteManifestCache.get(getContentManifestCacheKey(locales))
  );
}
