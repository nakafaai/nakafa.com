/**
 * Cache-Control of a public content document. The CDN keeps the document for an
 * hour and serves the stale copy for a day while it revalidates. A release changes
 * the document's source, and the next request reads the release that is active.
 */
const PUBLIC_CONTENT_CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

/** The response headers of one public content document. */
export const PUBLIC_CONTENT_HEADERS = {
  "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL,
} as const;
