const TRENDING_BUCKET_MS = 24 * 60 * 60 * 1e3;

/** Returns the UTC day bucket start for content trending counters. */
function getTrendingBucketStart(timestamp: number) {
  return Math.floor(timestamp / TRENDING_BUCKET_MS) * TRENDING_BUCKET_MS;
}

/** Builds the inclusive trending window used by content surfaces. */
function getTrendingTimeRange(days: number, nowMs: number) {
  const until = getTrendingBucketStart(nowMs) + TRENDING_BUCKET_MS;
  const since = until - days * TRENDING_BUCKET_MS;
  return { since, until };
}

export { getTrendingBucketStart, getTrendingTimeRange, TRENDING_BUCKET_MS };
