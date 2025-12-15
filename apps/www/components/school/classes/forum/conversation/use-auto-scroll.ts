"use client";

import type { VirtualConversationHandle } from "@repo/design-system/components/ui/virtual-conversation";
import { type RefObject, useEffect, useRef } from "react";

/**
 * Auto-scrolls to bottom when new messages arrive (if user is already at bottom).
 * Mimics Discord/Slack behavior where new messages push the view down only when at bottom.
 */
export function useAutoScroll({
  postsLength,
  isJumpMode,
  scrollRef,
}: {
  postsLength: number;
  isJumpMode: boolean;
  scrollRef: RefObject<VirtualConversationHandle | null>;
}) {
  const prevPostsLengthRef = useRef(postsLength);

  useEffect(() => {
    const prevLength = prevPostsLengthRef.current;
    const currentLength = postsLength;
    prevPostsLengthRef.current = currentLength;

    const hasNewPosts = currentLength > prevLength && prevLength > 0;
    if (hasNewPosts && !isJumpMode && scrollRef.current?.isAtBottom()) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToBottom();
      });
    }
  }, [postsLength, isJumpMode, scrollRef]);
}
