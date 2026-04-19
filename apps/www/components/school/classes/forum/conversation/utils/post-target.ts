const FORUM_POST_VISIBILITY_TOLERANCE = 24;

/** Returns whether any part of one post row is currently visible in the transcript. */
export function isForumPostVisible({
  container,
  element,
}: {
  container: HTMLDivElement;
  element: HTMLDivElement;
}) {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const viewportStart = containerRect.top + FORUM_POST_VISIBILITY_TOLERANCE;
  const viewportEnd = containerRect.bottom - FORUM_POST_VISIBILITY_TOLERANCE;

  return elementRect.bottom > viewportStart && elementRect.top < viewportEnd;
}
