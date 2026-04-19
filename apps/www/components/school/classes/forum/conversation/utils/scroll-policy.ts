const FORUM_PREFETCH_DISTANCE_RATIO = 0.75;
const FORUM_PREFETCH_DISTANCE_MIN = 200;
const FORUM_PREFETCH_DISTANCE_MAX = 600;

export type ForumHistoryBoundaryIntent = "newer" | "older" | null;

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

/** Returns whether one history edge can request another page for its boundary. */
export function shouldRequestHistoryBoundary({
  boundaryPostId,
  hasMore,
  isLoading,
  lastRequestedBoundaryPostId,
}: {
  boundaryPostId: string | null;
  hasMore: boolean;
  isLoading: boolean;
  lastRequestedBoundaryPostId: string | null;
}) {
  return (
    boundaryPostId !== null &&
    hasMore &&
    !isLoading &&
    lastRequestedBoundaryPostId !== boundaryPostId
  );
}

/** Keeps one history edge armed only while the user keeps pushing toward it. */
export function getNextForumHistoryBoundaryIntent({
  currentIntent,
  isMovingDown,
  isMovingUp,
  isNearBottom,
  isNearTop,
}: {
  currentIntent: ForumHistoryBoundaryIntent;
  isMovingDown: boolean;
  isMovingUp: boolean;
  isNearBottom: boolean;
  isNearTop: boolean;
}) {
  if (isNearTop && isMovingUp) {
    return "older";
  }

  if (isNearBottom && isMovingDown) {
    return "newer";
  }

  if (
    (currentIntent === "older" && (isMovingDown || !isNearTop)) ||
    (currentIntent === "newer" && (isMovingUp || !isNearBottom))
  ) {
    return null;
  }

  return currentIntent;
}
