import { clearContentRouteManifestCache } from "@repo/contents/_lib/manifest/cache/lifecycle";
import { getContentPublicRouteManifest } from "@repo/contents/_lib/manifest/cache/public-routes";
import type { ContentManifestRoute } from "@repo/contents/_lib/manifest/schema";
import { CONTENT_ROOT_VALUES } from "@repo/contents/_types/content";

const quranRootRoute = "/quran";
const subjectRootRoute = `/${CONTENT_ROOT_VALUES.subject}`;

/** Clears memoized sitemap route scans for tests and long-lived tools. */
export function clearSitemapRouteCache() {
  clearContentRouteManifestCache();
}

/** Static top-level routes that should always be present in the sitemap. */
export const baseRoutes = [
  "/",
  "/search",
  "/contributor",
  quranRootRoute,
  subjectRootRoute,
  "/terms-of-service",
  "/privacy-policy",
  "/security-policy",
];

/** Converts a validated manifest route into an app-level HTTP path string. */
function routeToPath(route: ContentManifestRoute) {
  return String(route);
}

/** Builds relative Quran routes from validated Quran data. */
export async function getQuranRoutes() {
  return (await getContentPublicRouteManifest()).quranRoutes.map(routeToPath);
}

/** Builds public educational routes that are backed by content or Quran data. */
export async function getPublicContentRoutes() {
  return (await getContentPublicRouteManifest()).contentRoutes.map(routeToPath);
}

/** Builds public educational request routes, including redirect-only URLs. */
export async function getPublicContentRequestRoutes() {
  return (await getContentPublicRouteManifest()).publicRequestRoutes.map(
    routeToPath
  );
}

/** Builds redirect-only public content routes with their canonical targets. */
export async function getPublicContentRedirects() {
  return (await getContentPublicRouteManifest()).redirects.map(
    ([source, target]) => [routeToPath(source), routeToPath(target)] as const
  );
}

/** Builds the deduplicated route list used by `/sitemap.xml` and indexing. */
export async function getSitemapRoutes() {
  const allRoutes = new Set([
    ...baseRoutes,
    ...(await getPublicContentRoutes()),
  ]);

  return Array.from(allRoutes);
}

/** Returns route roots that are backed by educational content pages. */
export async function getPublicContentRouteRoots() {
  return (await getContentPublicRouteManifest()).routeRoots.map(routeToPath);
}
