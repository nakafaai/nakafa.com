import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { FORUM_BOTTOM_THRESHOLD } from "@/components/school/classes/forum/conversation/data/pages";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";

function getPostElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-post-id]"));
}

function getConversationPostId({
  postIds,
  value,
}: {
  postIds: Id<"schoolClassForumPosts">[];
  value: string | undefined;
}) {
  if (!value) {
    return null;
  }

  return postIds.find((postId) => postId === value) ?? null;
}

function isElementVisibleInsideRoot({
  element,
  root,
}: {
  element: HTMLElement;
  root: HTMLElement;
}) {
  const elementRect = element.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();

  return elementRect.bottom > rootRect.top && elementRect.top < rootRect.bottom;
}

function isElementCenteredInsideRoot({
  element,
  root,
}: {
  element: HTMLElement;
  root: HTMLElement;
}) {
  const elementRect = element.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const centerThreshold = Math.max(32, Math.min(96, root.clientHeight * 0.12));
  const elementCenter = (elementRect.top + elementRect.bottom) / 2;
  const rootCenter = (rootRect.top + rootRect.bottom) / 2;

  return Math.abs(elementCenter - rootCenter) <= centerThreshold;
}

function isElementPlacementSettledInsideRoot({
  element,
  root,
}: {
  element: HTMLElement;
  root: HTMLElement;
}) {
  if (!isElementVisibleInsideRoot({ element, root })) {
    return false;
  }

  if (isElementCenteredInsideRoot({ element, root })) {
    return true;
  }

  const elementRect = element.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const elementCenter = (elementRect.top + elementRect.bottom) / 2;
  const rootCenter = (rootRect.top + rootRect.bottom) / 2;

  if (elementCenter < rootCenter) {
    return root.scrollTop <= FORUM_BOTTOM_THRESHOLD;
  }

  return getConversationBottomDistance(root) <= FORUM_BOTTOM_THRESHOLD;
}

function getElementDistanceToRootCenter({
  element,
  root,
}: {
  element: HTMLElement;
  root: HTMLElement;
}) {
  const elementRect = element.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const rootCenter = (rootRect.top + rootRect.bottom) / 2;

  if (elementRect.top <= rootCenter && elementRect.bottom >= rootCenter) {
    return 0;
  }

  if (elementRect.bottom < rootCenter) {
    return rootCenter - elementRect.bottom;
  }

  return elementRect.top - rootCenter;
}

/** Returns the current bottom distance from a normal scroll container. */
export function getConversationBottomDistance(root: HTMLElement) {
  return Math.max(0, root.scrollHeight - root.clientHeight - root.scrollTop);
}

/** Returns the first visible post id inside the current transcript viewport. */
export function getFirstVisibleConversationPostId({
  postIds,
  root,
}: {
  postIds: Id<"schoolClassForumPosts">[];
  root: HTMLElement;
}) {
  const visibleElement = getPostElements(root).find((element) =>
    isElementVisibleInsideRoot({ element, root })
  );

  return getConversationPostId({
    postIds,
    value: visibleElement?.dataset.postId,
  });
}

/** Returns the last visible post id inside the current transcript viewport. */
export function getLastVisibleConversationPostId({
  postIds,
  root,
}: {
  postIds: Id<"schoolClassForumPosts">[];
  root: HTMLElement;
}) {
  const visibleElement = getPostElements(root)
    .slice()
    .reverse()
    .find((element) => isElementVisibleInsideRoot({ element, root }));

  return getConversationPostId({
    postIds,
    value: visibleElement?.dataset.postId,
  });
}

/** Returns the visible post id closest to the viewport center line. */
export function getCenteredConversationPostId({
  postIds,
  root,
}: {
  postIds: Id<"schoolClassForumPosts">[];
  root: HTMLElement;
}) {
  const centeredElement = getPostElements(root)
    .filter((element) => isElementVisibleInsideRoot({ element, root }))
    .sort(
      (left, right) =>
        getElementDistanceToRootCenter({ element: left, root }) -
        getElementDistanceToRootCenter({ element: right, root })
    )
    .at(0);

  return getConversationPostId({
    postIds,
    value: centeredElement?.dataset.postId,
  });
}

/**
 * Captures the current semantic transcript view from real DOM placement.
 *
 * Restore scroll places post views at the viewport center, so persisted post
 * views must also be derived from the row nearest the viewport center. Using
 * the first visible row here would slowly drift the saved view upward across
 * repeated close/open cycles.
 *
 * References:
 * - https://react.dev/reference/react/useLayoutEffect
 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
 */
export function captureConversationView({
  postIds,
  root,
}: {
  postIds: Id<"schoolClassForumPosts">[];
  root: HTMLElement;
}) {
  if (getConversationBottomDistance(root) <= FORUM_BOTTOM_THRESHOLD) {
    return { kind: "bottom" } satisfies ConversationView;
  }

  const centeredPostId = getCenteredConversationPostId({
    postIds,
    root,
  });

  if (!centeredPostId) {
    return null;
  }

  return {
    kind: "post",
    postId: centeredPostId,
  } satisfies ConversationView;
}

/** Returns whether one semantic transcript view is already visible in the DOM. */
export function isConversationViewVisible({
  root,
  view,
}: {
  root: HTMLElement;
  view: ConversationView;
}) {
  if (view.kind === "bottom") {
    return getConversationBottomDistance(root) <= FORUM_BOTTOM_THRESHOLD;
  }

  const element = root.querySelector<HTMLElement>(
    `[data-post-id="${view.postId}"]`
  );

  if (!element) {
    return false;
  }

  return isElementVisibleInsideRoot({ element, root });
}

/**
 * Returns whether one semantic transcript view is already centered in the DOM.
 *
 * `go to message` should keep scrolling until the target row reaches the
 * viewport center, even if that row is already only partially visible.
 *
 * References:
 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
 * - https://react.dev/learn/manipulating-the-dom-with-refs
 */
export function isConversationViewCentered({
  root,
  view,
}: {
  root: HTMLElement;
  view: ConversationView;
}) {
  if (view.kind === "bottom") {
    return getConversationBottomDistance(root) <= FORUM_BOTTOM_THRESHOLD;
  }

  const element = root.querySelector<HTMLElement>(
    `[data-post-id="${view.postId}"]`
  );

  if (!element) {
    return false;
  }

  return isElementCenteredInsideRoot({ element, root });
}

/**
 * Returns whether one semantic post placement has settled as far as the DOM can
 * place it.
 *
 * `scrollIntoView({ block: "center" })` may clamp at the top or bottom edges
 * when there is not enough remaining scroll range to truly center the target.
 * Those edge-clamped placements should still count as settled so the jump
 * highlight can start once the target is visibly reached.
 *
 * References:
 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
 * - https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
 */
export function hasConversationViewSettledPlacement({
  root,
  view,
}: {
  root: HTMLElement;
  view: ConversationView;
}) {
  if (view.kind === "bottom") {
    return getConversationBottomDistance(root) <= FORUM_BOTTOM_THRESHOLD;
  }

  const element = root.querySelector<HTMLElement>(
    `[data-post-id="${view.postId}"]`
  );

  if (!element) {
    return false;
  }

  return isElementPlacementSettledInsideRoot({ element, root });
}

/**
 * Returns whether the current viewport has reached the semantic back target.
 *
 * A post target counts as reached once it becomes visible or scrolls above the
 * viewport top, which matches the "reached or passed" back-button rule.
 */
export function hasConversationViewReached({
  root,
  view,
}: {
  root: HTMLElement;
  view: ConversationView;
}) {
  if (isConversationViewVisible({ root, view })) {
    return true;
  }

  if (view.kind === "bottom") {
    return false;
  }

  const element = root.querySelector<HTMLElement>(
    `[data-post-id="${view.postId}"]`
  );

  if (!element) {
    return false;
  }

  return (
    element.getBoundingClientRect().top <= root.getBoundingClientRect().top
  );
}
