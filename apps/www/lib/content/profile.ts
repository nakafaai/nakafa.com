/**
 * Freshness policy shared by every signed content read and every content
 * invalidation. The profile name, the lifetime, and the revalidation window
 * live together so they cannot drift apart.
 *
 * A content change reaches production through the Aksara publication webhook,
 * which invalidates the exact scope that changed. The lifetime is therefore a
 * safety net for a missed invalidation, not the freshness guarantee.
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
 * `revalidate` stays at one hour because the repository site contract requires
 * an effective CDN lifetime of at most one hour for page responses, and this
 * profile also sets that header. `expire` is intentionally absent: expiring an
 * entry forces a synchronous regeneration on the next request, which is the
 * expensive path. Without it, a regeneration whose output is unchanged costs
 * no ISR write units, and every real change arrives through on-demand
 * invalidation.
 */
export const CONTENT_CACHE_LIFETIME = {
  stale: 300,
  revalidate: 3600,
} as const;

/**
 * Stale window applied when the publication webhook invalidates one scope.
 *
 * `max` serves the previous signed version while the next one is generated, so
 * a publish never becomes a blocking cache miss. Next.js documents this as the
 * recommended profile for on-demand revalidation.
 */
export const CONTENT_CACHE_REVALIDATION = "max";
