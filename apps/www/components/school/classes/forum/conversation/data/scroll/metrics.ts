import type { VirtualizerHandle } from "virtua";

export const CONVERSATION_EDGE_TOLERANCE = 2;

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
  return getConversationBottomDistance(handle) <= CONVERSATION_EDGE_TOLERANCE;
}

/** Returns whether the transcript viewport is settled at the first edge. */
export function isConversationAtTop(handle: ConversationGeometryHandle) {
  return handle.scrollOffset <= CONVERSATION_EDGE_TOLERANCE;
}

/**
 * Returns stable viewport booleans after Virtua has measured its viewport.
 */
export function getConversationViewportState(
  handle: ConversationGeometryHandle
) {
  if (handle.viewportSize <= 0) {
    return null;
  }

  return {
    hasOverflow:
      handle.scrollSize - handle.viewportSize > CONVERSATION_EDGE_TOLERANCE,
    isAtBottom: isConversationAtBottom(handle),
  };
}
