export type ConversationScrollIntent = "down" | "none" | "up";

/** Returns the user's scroll direction from two virtualizer offsets. */
export function getConversationScrollIntent({
  currentOffset,
  previousOffset,
}: {
  currentOffset: number;
  previousOffset: number;
}): ConversationScrollIntent {
  if (currentOffset < previousOffset) {
    return "up";
  }

  if (currentOffset > previousOffset) {
    return "down";
  }

  return "none";
}

/**
 * Returns whether latest-edge auto-stick should remain disabled.
 *
 * Plain viewport measurement must not reattach a user who already scrolled up;
 * only a downward user scroll that reaches the latest edge can reattach.
 */
export function getNextConversationBottomDetachment({
  isAtBottom,
  isDetachedFromBottom,
  scrollIntent,
}: {
  isAtBottom: boolean;
  isDetachedFromBottom: boolean;
  scrollIntent: ConversationScrollIntent;
}) {
  if (scrollIntent === "up") {
    return true;
  }

  if (scrollIntent === "down" && isAtBottom) {
    return false;
  }

  return isDetachedFromBottom;
}
