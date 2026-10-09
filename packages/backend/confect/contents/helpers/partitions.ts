import { CONTENT_ANALYTICS_PARTITION_COUNT } from "@repo/backend/confect/contents/constants";

/** Returns the stable analytics partition for a graph content ID. */
export function getContentAnalyticsPartition(contentId: string) {
  let partition = 0;
  for (const character of contentId) {
    partition =
      (partition * 31 + character.charCodeAt(0)) %
      CONTENT_ANALYTICS_PARTITION_COUNT;
  }
  return partition;
}

/** Returns whether a numeric partition belongs to the configured partition set. */
export function isContentAnalyticsPartition(partition: number) {
  return partition >= 0 && partition < CONTENT_ANALYTICS_PARTITION_COUNT;
}
