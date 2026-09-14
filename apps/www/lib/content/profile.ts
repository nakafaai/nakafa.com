/**
 * Freshness policy shared by every signed content read and every content
 * invalidation. The profile name, the lifetime, and the revalidation window
 * live together so they cannot drift apart.
 *
 * A content change reaches production through an authenticated request from the
 * Aksara publisher CLI to `/api/internal/content/cache`, which invalidates the
 * exact scope that changed. The lifetime is therefore a safety net for a missed
 * invalidation, not the freshness guarantee.
 *
 * References:
 * https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing#optimizing-isr-reads-and-writes
 * https://nextjs.org/docs/app/api-reference/functions/revalidateTag#revalidation-behavior
 */

/** Cache profile name registered for signed content reads in the Next config. */
export const CONTENT_CACHE_PROFILE = "contentRuntime";

/**
 * Lifetime applied to one cached signed content read.
 *
 * `revalidate` stays at one hour because the site contract in
 * `apps/www/checks/afdocs.test.ts` runs the AFDocs `cache-header-hygiene` check
 * against a local production server, where Next.js emits its own
 * `Cache-Control` with `s-maxage` equal to this value. That check passes at or
 * below 3600 seconds, warns between one hour and 24 hours, and fails above 24
 * hours, and a warning fails the suite. Vercel replaces that header with its own
 * edge header in production, so this value bounds the local contract rather than
 * the served response.
 *
 * `expire` is intentionally absent. Setting it forces a synchronous
 * regeneration on the next request once it elapses, which is the expensive path.
 * Leaving it out also drops the previous 24 hour hard expiry, so an entry is
 * refreshed in the background after `revalidate` instead of being regenerated in
 * the foreground.
 */
export const CONTENT_CACHE_LIFETIME = {
  stale: 300,
  revalidate: 3600,
} as const;

/**
 * Stale window applied when the publisher request invalidates one scope.
 *
 * `max` is Next.js's recommended stale-marking profile: the previous signed
 * version is served while the next one is generated, so a publish never becomes
 * a blocking cache miss. It sets the stale window only, not a new lifetime; the
 * entry keeps the `contentRuntime` lifetime above.
 */
export const CONTENT_CACHE_REVALIDATION = "max";
