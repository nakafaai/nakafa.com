import type {
  ContentPublicRouteManifest,
  ContentRouteManifest,
  ContentRouteParamManifest,
} from "@repo/contents/_lib/manifest/schema";

/** Extracts source-derived fields from a full route manifest. */
export function getParamManifestFromRouteManifest(
  manifest: ContentRouteManifest
) {
  return {
    version: manifest.version,
    exerciseApiParams: manifest.exerciseApiParams,
    localeParams: manifest.localeParams,
    staticParams: manifest.staticParams,
  };
}

/** Extracts static-param fields from a full route manifest. */
export function getStaticParamManifestFromRouteManifest(
  manifest: ContentRouteManifest
) {
  return {
    version: manifest.version,
    localeParams: manifest.localeParams,
    staticParams: manifest.staticParams,
  };
}

/** Extracts static-param fields from the route-param manifest. */
export function getStaticParamManifestFromParamManifest(
  manifest: ContentRouteParamManifest
) {
  return {
    version: manifest.version,
    localeParams: manifest.localeParams,
    staticParams: manifest.staticParams,
  };
}

/** Extracts public route fields from a full route manifest. */
export function getPublicRouteManifestFromRouteManifest(
  manifest: ContentRouteManifest
): ContentPublicRouteManifest {
  return {
    version: manifest.version,
    contentRoutes: manifest.contentRoutes,
    publicRequestRoutes: manifest.publicRequestRoutes,
    quranRoutes: manifest.quranRoutes,
    redirects: manifest.redirects,
    routeRoots: manifest.routeRoots,
  };
}
