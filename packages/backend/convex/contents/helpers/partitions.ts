import { CONTENT_ANALYTICS_PARTITION_COUNT } from "@repo/backend/convex/contents/constants";

/** Maps a stable string key to one configured analytics partition. */
function getPartitionFromKey(value: string) {
  let partition = 0;

  for (const character of value) {
    partition =
      (partition * 31 + character.charCodeAt(0)) %
      CONTENT_ANALYTICS_PARTITION_COUNT;
  }

  return partition;
}

/** Returns the stable analytics partition for a graph content ID. */
export function getContentAnalyticsPartition(contentId: string) {
  return getPartitionFromKey(contentId);
}

/** Returns whether a numeric partition belongs to the configured partition set. */
export function isContentAnalyticsPartition(partition: number) {
  return partition >= 0 && partition < CONTENT_ANALYTICS_PARTITION_COUNT;
}
