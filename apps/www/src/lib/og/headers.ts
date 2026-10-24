/**
 * Lets the CDN keep a social image for an hour, and serve a stale one for a
 * day while it renders the next. An image changes only when its route changes,
 * and a route changes only with a release.
 *
 * The hour is the longest that a CDN copy of an image may outlive its source
 * without a purge. The first request after it gets the stale image at once and
 * starts a new render. The browser always asks again, as it does for the sitemap. A page outside the content
 * namespaces has no signed owner and shows the generic copy of the site, so
 * its image carries these headers too.
 */
export const OG_IMAGE_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
} as const;

/**
 * The same tag with a short lifetime, for the brand image that answers, with a
 * 404, a route inside a content namespace (articles, material, the Quran or
 * try-out) that the release does not list. The next release may add that
 * route, and bots ask for routes that never exist, so this answer is kept for
 * minutes only.
 */
export const OG_FALLBACK_HEADERS = {
  ...OG_IMAGE_HEADERS,
  "Cache-Control": "public, max-age=0, s-maxage=300",
} as const;
