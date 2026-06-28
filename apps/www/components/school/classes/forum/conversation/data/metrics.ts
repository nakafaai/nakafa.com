import type { VirtualizerHandle } from "virtua";
import { FORUM_BOTTOM_THRESHOLD } from "@/components/school/classes/forum/conversation/data/pages";

/** Minimal virtualizer geometry used by transcript scroll calculations. */
export type ConversationGeometryHandle = Pick<
  VirtualizerHandle,
  | "findItemIndex"
  | "getItemOffset"
  | "getItemSize"
  | "scrollOffset"
  | "scrollSize"
  | "viewportSize"
>;

/** Returns the current bottom distance from the active virtualizer metrics. */
export function getConversationBottomDistance(
  handle: ConversationGeometryHandle
) {
  return Math.max(
    0,
    handle.scrollSize - handle.viewportSize - handle.scrollOffset
  );
}

/** Returns whether the transcript viewport is settled at the latest edge. */
export function isConversationAtBottom(handle: ConversationGeometryHandle) {
  return getConversationBottomDistance(handle) <= FORUM_BOTTOM_THRESHOLD;
}

/** Returns whether the transcript viewport is settled at the first edge. */
export function isConversationAtTop(handle: ConversationGeometryHandle) {
  return handle.scrollOffset <= FORUM_BOTTOM_THRESHOLD;
}

/**
 * Returns stable viewport booleans after Virtua has measured its viewport.
 * A detached viewer is never treated as at-bottom until they scroll back down.
 */
export function getConversationViewportState(
  handle: ConversationGeometryHandle,
  options: {
    isDetachedFromBottom?: boolean;
  } = {}
) {
  if (handle.viewportSize <= 0) {
    return null;
  }

  const isAtBottom =
    !options.isDetachedFromBottom && isConversationAtBottom(handle);

  return {
    hasOverflow:
      handle.scrollSize - handle.viewportSize > FORUM_BOTTOM_THRESHOLD,
    isAtBottom,
  };
}
