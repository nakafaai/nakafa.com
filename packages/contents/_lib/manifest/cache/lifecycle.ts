import {
  contentPublicRouteManifestCache,
  contentRouteManifestCache,
  contentRouteParamManifestCache,
  contentStaticParamManifestCache,
} from "@repo/contents/_lib/manifest/cache/store";
import { ContentRouteSource } from "@repo/contents/_lib/manifest/source";
import { Effect } from "effect";

/** Clears all native Effect caches that hold derived manifest data. */
export function resetContentRouteManifestCache() {
  Effect.runSync(
    Effect.all(
      [
        contentRouteManifestCache.invalidateAll,
        contentRouteParamManifestCache.invalidateAll,
        contentPublicRouteManifestCache.invalidateAll,
        contentStaticParamManifestCache.invalidateAll,
      ],
      { discard: true }
    )
  );
}

/** Clears folder scans and all native Effect caches that derive from them. */
export function clearContentRouteManifestCache() {
  resetContentRouteManifestCache();
  Effect.runSync(
    ContentRouteSource.clearFolderCache.pipe(
      Effect.provide(ContentRouteSource.Default)
    )
  );
}
