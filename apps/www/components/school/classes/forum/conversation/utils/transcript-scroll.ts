const FORUM_READ_STATE_NEAR_BOTTOM_THRESHOLD = 50;
const TRANSCRIPT_SCROLL_BOTTOM_EPSILON = 2;

/** Returns whether the transcript currently sits at the live bottom edge. */
export function isAtTranscriptBottom(container: HTMLDivElement) {
  return (
    container.scrollHeight - container.clientHeight - container.scrollTop <=
    TRANSCRIPT_SCROLL_BOTTOM_EPSILON
  );
}

/** Returns how many pixels separate the transcript from its bottom edge. */
export function getDistanceFromBottom(container: HTMLDivElement) {
  return Math.max(
    0,
    container.scrollHeight - container.clientHeight - container.scrollTop
  );
}

/** Returns whether the transcript is close enough to bottom for read-state UX. */
export function isNearReadStateBottom(
  container: HTMLDivElement | null | undefined
) {
  return (
    !!container &&
    (isAtTranscriptBottom(container) ||
      getDistanceFromBottom(container) <=
        FORUM_READ_STATE_NEAR_BOTTOM_THRESHOLD)
  );
}
