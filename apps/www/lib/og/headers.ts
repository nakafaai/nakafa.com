/** One CDN-only tag shared by every social image response. */
export const OG_CACHE_TAG = "content-og";

/**
 * Lets the CDN keep a social image for a day, and a stale one for a second day
 * while it renders the next. An image changes only when its route changes, and
 * a route changes only with a release, so the activation of a release purges
 * this tag. The lifetime bounds an image that a failed purge left behind. The
 * browser always asks again, as it does for the sitemap.
 */
export const OG_IMAGE_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
  "Vercel-Cache-Tag": OG_CACHE_TAG,
} as const;

/**
 * The same tag with a short lifetime, for the brand image that answers a route
 * the release does not know. The next release may add that route, and bots ask
 * for routes that never exist, so this answer is kept for minutes only.
 */
export const OG_FALLBACK_HEADERS = {
  ...OG_IMAGE_HEADERS,
  "Cache-Control": "public, max-age=0, s-maxage=300",
} as const;
