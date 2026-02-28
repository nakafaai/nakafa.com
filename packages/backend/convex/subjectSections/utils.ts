/**
 * Milliseconds in one hour.
 */
const HOUR_MS = 60 * 60 * 1000;

/**
 * Get rounded timestamps for optimal Convex caching.
 * Rounds to nearest hour so all clients within same hour share cache.
 *
 * @example
 * const { since, until } = getTrendingTimeRange(7); // Last 7 days
 */
export function getTrendingTimeRange(days: number): {
  since: number;
  until: number;
} {
  const until = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  const since = until - days * 24 * HOUR_MS;
  return { since, until };
}
