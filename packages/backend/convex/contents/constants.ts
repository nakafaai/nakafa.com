import {
  LEARNING_OBJECT_KIND_VALUES,
  SOURCE_REGISTRY_ROOT_VALUES,
} from "@repo/contents/_types/graph/schema";

/** Number of queued analytics rows processed in one mutation. */
export const CONTENT_ANALYTICS_BATCH_SIZE = 250;

/** Number of popularity counters recomputed from daily signals in one mutation. */
export const LEARNING_POPULARITY_REFRESH_BATCH_SIZE = 10;

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
export const NAKAFA_CONTENT_SECTIONS = SOURCE_REGISTRY_ROOT_VALUES;

/** Concrete synced route families in the durable content catalog. */
export const CONTENT_ROUTE_KINDS = LEARNING_OBJECT_KIND_VALUES;

/** Maximum route rows stored in one sitemap or LLMS route artifact page. */
export const CONTENT_ROUTE_ARTIFACT_PAGE_SIZE = 100;
