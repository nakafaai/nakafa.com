import type { VirtualConversationHandle } from "@repo/design-system/types/virtual";

const FORUM_POST_VISIBILITY_TOLERANCE = 24;

/** Returns whether any part of one post row is currently visible in the viewport. */
export function isForumPostVisible({
  handle,
  index,
}: {
  handle: Pick<
    VirtualConversationHandle,
    "getItemOffset" | "getItemSize" | "getScrollOffset" | "getViewportSize"
  >;
  index: number;
}) {
  const scrollOffset = handle.getScrollOffset();
  const viewportSize = handle.getViewportSize();

  if (viewportSize <= 0) {
    return false;
  }

  const itemOffset = handle.getItemOffset(index);
  const itemSize = handle.getItemSize(index);
  const viewportStart = scrollOffset + FORUM_POST_VISIBILITY_TOLERANCE;
  const viewportEnd =
    scrollOffset + viewportSize - FORUM_POST_VISIBILITY_TOLERANCE;
  const itemEnd = itemOffset + itemSize;

  return itemEnd > viewportStart && itemOffset < viewportEnd;
}
