import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";

/** Measures one transcript row with fractional precision for TanStack sizing. */
export function measureConversationItemSize(
  element: HTMLDivElement,
  entry: ResizeObserverEntry | undefined
) {
  const borderBoxSize = Array.isArray(entry?.borderBoxSize)
    ? entry.borderBoxSize[0]
    : entry?.borderBoxSize;

  if (borderBoxSize) {
    return borderBoxSize.blockSize;
  }

  return element.getBoundingClientRect().height;
}

/** Estimates one transcript row size before TanStack measures the real element. */
export function estimateConversationItemSize(item: VirtualItem | undefined) {
  if (!item) {
    return 120;
  }

  if (item.type === "header") {
    return 120;
  }

  if (item.type === "date" || item.type === "unread") {
    return 48;
  }

  return 160;
}

/** Builds one stable TanStack item key for the current semantic transcript row. */
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

/** Returns the oldest and newest loaded post ids from one semantic transcript. */
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

/** Returns the current virtual scroll metrics from TanStack state and DOM fallback state. */
export function getTranscriptScrollMetrics({
  fallbackClientHeight,
  fallbackScrollTop,
  scrollOffset,
  scrollRectHeight,
}: {
  fallbackClientHeight: number | undefined;
  fallbackScrollTop: number | undefined;
  scrollOffset: number | null | undefined;
  scrollRectHeight: number | null | undefined;
}) {
  const nextScrollOffset = scrollOffset ?? fallbackScrollTop ?? 0;
  const viewportHeight = scrollRectHeight ?? fallbackClientHeight ?? 0;

  return {
    scrollOffset: nextScrollOffset,
    viewportBottom: nextScrollOffset + viewportHeight,
    viewportHeight,
  };
}

/** Returns the current distance between the viewport and transcript bottom. */
export function getConversationBottomDistance({
  scrollOffset,
  totalSize,
  viewportHeight,
}: {
  scrollOffset: number;
  totalSize: number;
  viewportHeight: number;
}) {
  return Math.max(0, totalSize - viewportHeight - scrollOffset);
}

/** Captures the first visible post anchor used for restore and prepend correction. */
export function captureVisibleConversationAnchor({
  items,
  scrollOffset,
  viewportBottom,
  virtualItems,
}: {
  items: VirtualItem[];
  scrollOffset: number;
  viewportBottom: number;
  virtualItems: Array<{
    end: number;
    index: number;
    start: number;
  }>;
}) {
  for (const virtualItem of virtualItems) {
    const item = items[virtualItem.index];

    if (virtualItem.start >= viewportBottom) {
      break;
    }

    if (!(item?.type === "post" && virtualItem.end > scrollOffset)) {
      continue;
    }

    return {
      offset: virtualItem.start - scrollOffset,
      postId: item.post._id,
    };
  }

  return null;
}

/** Returns whether the target post is currently visible inside mounted virtual items. */
export function isConversationPostVisible({
  postId,
  postIdToIndex,
  scrollOffset,
  viewportBottom,
  virtualItems,
}: {
  postId: Id<"schoolClassForumPosts">;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  scrollOffset: number;
  viewportBottom: number;
  virtualItems: Array<{
    end: number;
    index: number;
    start: number;
  }>;
}) {
  const index = postIdToIndex.get(postId);

  if (index === undefined) {
    return false;
  }

  const visibleItem = virtualItems.find(
    (virtualItem) => virtualItem.index === index
  );

  if (!visibleItem) {
    return false;
  }

  return visibleItem.start < viewportBottom && visibleItem.end > scrollOffset;
}
