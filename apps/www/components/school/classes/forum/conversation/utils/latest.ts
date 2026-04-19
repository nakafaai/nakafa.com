import type { VirtualConversationHandle } from "@repo/design-system/types/virtual";
import type { RefObject } from "react";

type LatestScrollHandle = Pick<VirtualConversationHandle, "scrollToBottom">;

interface GoToLatestEdgeOptions {
  cancelPendingJumpRequest: () => void;
  clearPendingPostTarget: () => void;
  clearScrollCommand: () => void;
  isAtLatestEdge: boolean;
  markPendingBottomPersistence: () => void;
  pendingLatestSessionRef: RefObject<boolean>;
  scrollRef: RefObject<LatestScrollHandle | null>;
  showLatestPosts: () => void;
  showLiveConversation: () => void;
}

/**
 * Navigates the forum conversation to the live latest edge without deciding
 * whether transient back history should be preserved or cleared.
 */
export function goToLatestEdge({
  cancelPendingJumpRequest,
  clearPendingPostTarget,
  clearScrollCommand,
  isAtLatestEdge,
  markPendingBottomPersistence,
  pendingLatestSessionRef,
  scrollRef,
  showLatestPosts,
  showLiveConversation,
}: GoToLatestEdgeOptions) {
  markPendingBottomPersistence();
  cancelPendingJumpRequest();
  clearPendingPostTarget();

  if (isAtLatestEdge) {
    pendingLatestSessionRef.current = false;
    scrollRef.current?.scrollToBottom();
    return;
  }

  pendingLatestSessionRef.current = true;
  clearScrollCommand();
  showLiveConversation();
  showLatestPosts();
}
