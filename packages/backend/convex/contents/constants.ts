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

/** Public Nakafa website origin used for canonical content URLs. */
export const NAKAFA_CONTENT_BASE_URL = "https://nakafa.com";

/** Public content sections persisted in the Convex content search read model. */
export const NAKAFA_CONTENT_SECTIONS = [
  "articles",
  "subject",
  "exercises",
  "quran",
] as const;

/** Concrete synced route families in the durable content catalog. */
export const CONTENT_ROUTE_KINDS = [
  "article",
  "subject-topic",
  "subject-section",
  "exercise-group",
  "exercise-set",
  "exercise-question",
  "quran-surah",
] as const;

/** Maximum route rows stored in one sitemap or LLMS route artifact page. */
export const CONTENT_ROUTE_ARTIFACT_PAGE_SIZE = 100;
