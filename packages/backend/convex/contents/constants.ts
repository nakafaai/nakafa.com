/** Number of queued analytics rows processed in one mutation. */
export const CONTENT_ANALYTICS_BATCH_SIZE = 250;

/** Number of independent analytics partitions. */
export const CONTENT_ANALYTICS_PARTITION_COUNT = 16;

/** Duration a partition lease stays active before recovery can reclaim it. */
export const CONTENT_ANALYTICS_LEASE_DURATION_MS = 5 * 60 * 1000;

/** Stable list of analytics partitions used by cron scheduling. */
export const CONTENT_ANALYTICS_PARTITIONS = Array.from(
  { length: CONTENT_ANALYTICS_PARTITION_COUNT },
  (_, partition) => partition
);
