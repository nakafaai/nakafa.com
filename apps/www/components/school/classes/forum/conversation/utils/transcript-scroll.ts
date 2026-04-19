import type { Id } from "@repo/backend/convex/_generated/dataModel";

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

/** Measures one row's absolute offset from the top of the scroll container. */
export function getPostOffsetTop({
  container,
  element,
}: {
  container: HTMLDivElement;
  element: HTMLDivElement;
}) {
  return (
    container.scrollTop +
    element.getBoundingClientRect().top -
    container.getBoundingClientRect().top
  );
}

/** Returns one clamped scrollTop target for the transcript container. */
export function clampScrollTop(container: HTMLDivElement, scrollTop: number) {
  const maxScrollTop = Math.max(
    0,
    container.scrollHeight - container.clientHeight
  );
  return Math.min(Math.max(0, scrollTop), maxScrollTop);
}

/** Captures the first visible post row and its exact viewport offset. */
export function findVisiblePostAnchor({
  container,
  orderedPostIds,
  postElements,
}: {
  container: HTMLDivElement;
  orderedPostIds: Id<"schoolClassForumPosts">[];
  postElements: Map<Id<"schoolClassForumPosts">, HTMLDivElement>;
}) {
  const containerRect = container.getBoundingClientRect();

  for (const postId of orderedPostIds) {
    const element = postElements.get(postId);

    if (!element) {
      continue;
    }

    const rect = element.getBoundingClientRect();

    if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom) {
      continue;
    }

    return {
      postId,
      top: rect.top - containerRect.top,
    };
  }

  return null;
}

/** Resolves one scrollTop target for a post row landing. */
export function getScrollTopForPost({
  align,
  container,
  element,
  offset,
}: {
  align: "center" | "start";
  container: HTMLDivElement;
  element: HTMLDivElement;
  offset: number;
}) {
  const absoluteTop = getPostOffsetTop({ container, element });

  if (align === "center") {
    return (
      absoluteTop - (container.clientHeight - element.offsetHeight) / 2 + offset
    );
  }

  return absoluteTop - offset;
}
