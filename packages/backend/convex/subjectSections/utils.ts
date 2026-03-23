export const TRENDING_BUCKET_MS = 24 * 60 * 60 * 1000;

export function getTrendingBucketStart(timestamp: number) {
  return Math.floor(timestamp / TRENDING_BUCKET_MS) * TRENDING_BUCKET_MS;
}

/**
 * Get day-bucketed timestamps for stable caching and bounded trending reads.
 *
 * @example
 * const { since, until } = getTrendingTimeRange(7); // Last 7 days
 */
export function getTrendingTimeRange(days: number): {
  since: number;
  until: number;
} {
  const until = getTrendingBucketStart(Date.now()) + TRENDING_BUCKET_MS;
  const since = until - days * TRENDING_BUCKET_MS;

  return { since, until };
}
