const FORUM_PREFETCH_DISTANCE_RATIO = 0.75;
const FORUM_PREFETCH_DISTANCE_MIN = 200;
const FORUM_PREFETCH_DISTANCE_MAX = 600;

/** Derives the prefetch distance for loading more history near transcript edges. */
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
