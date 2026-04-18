const FORUM_PREFETCH_DISTANCE_RATIO = 0.75;
const FORUM_PREFETCH_DISTANCE_MIN = 200;
const FORUM_PREFETCH_DISTANCE_MAX = 600;

/**
 * Derive one viewport-relative prefetch distance so history loads before the
 * user hits a hard edge on either side of the conversation.
 */
export function getForumPrefetchDistance(viewportSize: number) {
  return Math.min(
    Math.max(
      Math.round(viewportSize * FORUM_PREFETCH_DISTANCE_RATIO),
      FORUM_PREFETCH_DISTANCE_MIN
    ),
    FORUM_PREFETCH_DISTANCE_MAX
  );
}
