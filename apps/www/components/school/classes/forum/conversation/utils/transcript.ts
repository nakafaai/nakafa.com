import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualizerHandle } from "virtua";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";

const TRANSCRIPT_POST_ROW_SELECTOR = "[data-post-id]";
const TRANSCRIPT_SCROLL_EPSILON = 1;

export interface ConversationDomAnchor {
  postId: Id<"schoolClassForumPosts">;
  topWithinScrollRoot: number;
}

interface ConversationScrollMetrics {
  scrollHeight: number;
  scrollOffset: number;
  viewportHeight: number;
}

type ConversationScrollHandle = Pick<
  VirtualizerHandle,
  "scrollOffset" | "scrollSize" | "viewportSize"
>;

/** Builds one stable semantic key for a transcript row. */
export function getConversationItemKey(item: VirtualItem) {
  if (item.type === "header") {
    return "header";
  }

  if (item.type === "date") {
    return `date:${item.date}`;
  }

  if (item.type === "unread") {
    return `unread:${item.postId}`;
  }

  return `post:${item.post._id}`;
}

/** Returns the current oldest and newest loaded post ids. */
export function getLoadedPostBoundaries(items: VirtualItem[]) {
  let newestPostId: Id<"schoolClassForumPosts"> | null = null;
  let oldestPostId: Id<"schoolClassForumPosts"> | null = null;

  for (const item of items) {
    if (item.type !== "post") {
      continue;
    }

    oldestPostId ??= item.post._id;
    newestPostId = item.post._id;
  }

  return {
    newestPostId,
    oldestPostId,
  };
}

/** Reads scroll metrics from the real scroll root with handle fallbacks. */
export function getConversationScrollMetrics({
  handle,
  scrollElement,
}: {
  handle: ConversationScrollHandle | null;
  scrollElement: HTMLDivElement | null;
}) {
  return {
    scrollHeight: scrollElement?.scrollHeight ?? handle?.scrollSize ?? 0,
    scrollOffset: scrollElement?.scrollTop ?? handle?.scrollOffset ?? 0,
    viewportHeight: scrollElement?.clientHeight ?? handle?.viewportSize ?? 0,
  } satisfies ConversationScrollMetrics;
}

/** Returns the distance from the current viewport to the transcript bottom. */
export function getConversationBottomDistance(
  metrics: ConversationScrollMetrics
) {
  return Math.max(
    0,
    metrics.scrollHeight - metrics.viewportHeight - metrics.scrollOffset
  );
}

/** Finds one rendered transcript post row by semantic post id. */
export function findConversationPostRow({
  postId,
  scrollElement,
}: {
  postId: Id<"schoolClassForumPosts">;
  scrollElement: HTMLDivElement;
}) {
  for (const element of scrollElement.querySelectorAll<HTMLElement>(
    TRANSCRIPT_POST_ROW_SELECTOR
  )) {
    if (element.dataset.postId === postId) {
      return element;
    }
  }

  return null;
}

/** Returns a rendered row top relative to the current scroll root. */
export function getConversationRowTopWithinScrollRoot({
  element,
  scrollElement,
}: {
  element: HTMLElement;
  scrollElement: HTMLDivElement;
}) {
  return (
    element.getBoundingClientRect().top -
    scrollElement.getBoundingClientRect().top
  );
}

/** Captures the first visible rendered post row as a semantic DOM anchor. */
export function captureVisibleConversationDomAnchor({
  scrollElement,
}: {
  scrollElement: HTMLDivElement;
}) {
  const rootRect = scrollElement.getBoundingClientRect();

  for (const element of scrollElement.querySelectorAll<HTMLElement>(
    TRANSCRIPT_POST_ROW_SELECTOR
  )) {
    const postId = element.dataset.postId;

    if (!postId) {
      continue;
    }

    const rect = element.getBoundingClientRect();

    if (rect.bottom <= rootRect.top) {
      continue;
    }

    if (rect.top >= rootRect.bottom) {
      break;
    }

    return {
      postId: postId as Id<"schoolClassForumPosts">,
      topWithinScrollRoot: getConversationRowTopWithinScrollRoot({
        element,
        scrollElement,
      }),
    } satisfies ConversationDomAnchor;
  }

  return null;
}

/** Returns whether one rendered post row is visible inside the current viewport. */
export function isConversationPostVisibleInDom({
  postId,
  scrollElement,
}: {
  postId: Id<"schoolClassForumPosts">;
  scrollElement: HTMLDivElement;
}) {
  const row = findConversationPostRow({
    postId,
    scrollElement,
  });

  if (!row) {
    return false;
  }

  const rootRect = scrollElement.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();

  return rowRect.top < rootRect.bottom && rowRect.bottom > rootRect.top;
}

/** Reconciles one semantic DOM anchor until the target row reaches its saved top offset. */
export function reconcileConversationDomAnchor({
  anchor,
  scrollElement,
}: {
  anchor: ConversationDomAnchor;
  scrollElement: HTMLDivElement;
}) {
  const row = findConversationPostRow({
    postId: anchor.postId,
    scrollElement,
  });

  if (!row) {
    return "missing" as const;
  }

  const currentTopWithinScrollRoot = getConversationRowTopWithinScrollRoot({
    element: row,
    scrollElement,
  });
  const delta = currentTopWithinScrollRoot - anchor.topWithinScrollRoot;

  if (!needsConversationDomAnchorCorrection(delta)) {
    return "settled" as const;
  }

  scrollElement.scrollTop += delta;

  return "pending" as const;
}

/** Returns whether a DOM-anchor correction still exceeds the accepted pixel epsilon. */
export function needsConversationDomAnchorCorrection(delta: number) {
  return Math.abs(delta) > TRANSCRIPT_SCROLL_EPSILON;
}
