/**
 * Freshness policy shared by mutable signed content reads and content
 * invalidation. The profile name, the lifetime, and the revalidation window
 * live together so they cannot drift apart.
 *
 * A content change reaches production through an authenticated request from the
 * Aksara publisher CLI to `/api/internal/content/cache`, which invalidates the
 * exact scope that changed. That request reaches one instance. The default
 * `use cache` handler keeps its entries and its record of revalidated tags in
 * the memory of each process (`next/dist/server/lib/cache-handlers/default.js`),
 * so an entry in any other instance ends only with its lifetime. The lifetime is
 * therefore the bound on how long a release can be missed, and an entry may go
 * without it only when its key names the release. Immutable artifacts use
 * Next.js's `max` lifetime because their content hash is already part of the
 * cache key.
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
 * against a local production server. The check reads the `Cache-Control`
 * response header of the llms.txt files and of the sampled pages, `s-maxage`
 * first, and passes at or below 3600 seconds, warns between one hour and 24
 * hours, and fails above 24 hours. A warning fails the suite. It measures the
 * header, not a lifetime, but Next.js writes the header of a page from the
 * lowest `revalidate` among the cache entries that the page used
 * (`collectedRevalidate` in `next/dist/server/app-render/app-render.js`), and
 * it writes one only when the response has none. So a page may use longer
 * entries as long as one entry of the page stays at or below 3600 seconds, and
 * every page under `app/[locale]/(app)/layout.tsx` has one: the page
 * navigation. The llms.txt and Markdown routes set their own header. Vercel
 * replaces the header in production, so this value bounds the local contract
 * rather than the served response.
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
