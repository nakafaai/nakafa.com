import type { VirtualConversationHandle } from "@repo/design-system/types/virtual";
import type { RefObject } from "react";

type LatestScrollHandle = Pick<VirtualConversationHandle, "scrollToBottom">;

interface GoToLatestEdgeOptions {
  cancelPendingJumpRequest: () => void;
  clearScrollCommand: () => void;
  isAtLatestEdge: boolean;
  markPendingBottomPersistence: () => void;
  pendingLatestSessionRef: RefObject<boolean>;
  scrollRef: RefObject<LatestScrollHandle | null>;
  showLatestPosts: () => void;
  showLiveConversation: () => void;
  smooth: boolean;
}

/**
 * Navigates the forum conversation to the live latest edge without deciding
 * whether transient back history should be preserved or cleared.
 */
export function goToLatestEdge({
  cancelPendingJumpRequest,
  clearScrollCommand,
  isAtLatestEdge,
  markPendingBottomPersistence,
  pendingLatestSessionRef,
  scrollRef,
  showLatestPosts,
  showLiveConversation,
  smooth,
}: GoToLatestEdgeOptions) {
  markPendingBottomPersistence();
  cancelPendingJumpRequest();

  if (isAtLatestEdge) {
    pendingLatestSessionRef.current = false;
    scrollRef.current?.scrollToBottom(smooth);
    return;
  }

  pendingLatestSessionRef.current = true;
  clearScrollCommand();
  showLiveConversation();
  showLatestPosts();
}
