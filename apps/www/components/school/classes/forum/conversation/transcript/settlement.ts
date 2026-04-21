import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import type { ForumConversationView } from "@/components/school/classes/forum/conversation/models";
import { shouldContinueBottomPin } from "@/components/school/classes/forum/conversation/transcript/effects";
import { syncHistoryWindow } from "@/components/school/classes/forum/conversation/transcript/history";
import type {
  BottomPinState,
  GetTranscriptMetrics,
  PendingAnchor,
} from "@/components/school/classes/forum/conversation/transcript/types";
import {
  captureVisibleConversationDomAnchor,
  getConversationBottomDistance,
  isConversationPostVisibleInDom,
  reconcileConversationDomAnchor,
} from "@/components/school/classes/forum/conversation/utils/transcript";

/** Persists the current settled semantic transcript view from the real DOM. */
export function persistSettledView({
  getMetrics,
  handleSettledView,
  scrollElementRef,
}: {
  getMetrics: GetTranscriptMetrics;
  handleSettledView: (view: ForumConversationView) => void;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}) {
  const currentScrollElement = scrollElementRef.current;

  if (!currentScrollElement) {
    return false;
  }

  if (getConversationBottomDistance(getMetrics()) <= 1) {
    handleSettledView({ kind: "bottom" });
    return true;
  }

  const anchor = captureVisibleConversationDomAnchor({
    scrollElement: currentScrollElement,
  });

  if (!anchor) {
    return false;
  }

  handleSettledView({
    kind: "post",
    offset: anchor.topWithinScrollRoot,
    postId: anchor.postId,
  });
  return true;
}

/** Clears pending highlight intent once the target row is actually visible. */
export function syncHighlightVisibility({
  handleHighlightVisiblePost,
  pendingHighlightPostId,
  scrollElementRef,
}: {
  handleHighlightVisiblePost: (postId: Id<"schoolClassForumPosts">) => void;
  pendingHighlightPostId: Id<"schoolClassForumPosts"> | null;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}) {
  const currentScrollElement = scrollElementRef.current;

  if (!(pendingHighlightPostId && currentScrollElement)) {
    return;
  }

  if (
    isConversationPostVisibleInDom({
      postId: pendingHighlightPostId,
      scrollElement: currentScrollElement,
    })
  ) {
    handleHighlightVisiblePost(pendingHighlightPostId);
  }
}

/** Reconciles one restore anchor until the target row reaches its saved offset. */
export function settleAnchor({
  pendingAnchorRef,
  scrollElementRef,
}: {
  pendingAnchorRef: RefObject<PendingAnchor | null>;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}) {
  const anchor = pendingAnchorRef.current;
  const currentScrollElement = scrollElementRef.current;

  if (!(anchor && currentScrollElement)) {
    return false;
  }

  const status = reconcileConversationDomAnchor({
    anchor: {
      postId: anchor.postId,
      topWithinScrollRoot: anchor.offset,
    },
    scrollElement: currentScrollElement,
  });

  if (status === "missing" || status === "pending") {
    return true;
  }

  pendingAnchorRef.current = null;
  return false;
}

/** Continues a bounded pin-to-bottom reconciliation until the DOM reaches bottom. */
export function continueBottomPin({
  bottomPinRef,
  clearScrollRequest,
  getMetrics,
  scrollToBottom,
}: {
  bottomPinRef: RefObject<BottomPinState | null>;
  clearScrollRequest: (requestId: number) => void;
  getMetrics: GetTranscriptMetrics;
  scrollToBottom: (behavior: "auto" | "smooth") => void;
}) {
  const pin = bottomPinRef.current;

  if (!pin) {
    return false;
  }

  if (getConversationBottomDistance(getMetrics()) <= 1) {
    if (pin.requestId !== null) {
      clearScrollRequest(pin.requestId);
      pin.requestId = null;
    }

    bottomPinRef.current = null;
    return false;
  }

  if (!shouldContinueBottomPin(pin.attempts)) {
    if (pin.requestId !== null) {
      clearScrollRequest(pin.requestId);
    }

    bottomPinRef.current = null;
    return false;
  }

  pin.attempts += 1;
  scrollToBottom("auto");
  return true;
}

/** Runs one full transcript settlement pass and reports whether another frame is needed. */
export function settleTranscriptFrame({
  bottomBoundaryPostIdRef,
  bottomPinRef,
  clearScrollRequest,
  getMetrics,
  handleBottomStateChange,
  handleHighlightVisiblePost,
  handleSettledView,
  hasMoreAfter,
  hasMoreBefore,
  isAtLatestEdge,
  isLoadingNewer,
  isLoadingOlder,
  lastPostId,
  loadedNewestPostId,
  loadedOldestPostId,
  loadNewerPosts,
  loadOlderPosts,
  pendingAnchorRef,
  pendingHighlightPostId,
  scheduleMarkRead,
  scrollElementRef,
  scrollToBottom,
  setShiftBoundaryPostId,
  topBoundaryPostIdRef,
  transcriptVariant,
}: {
  bottomBoundaryPostIdRef: RefObject<Id<"schoolClassForumPosts"> | null>;
  bottomPinRef: RefObject<BottomPinState | null>;
  clearScrollRequest: (requestId: number) => void;
  getMetrics: GetTranscriptMetrics;
  handleBottomStateChange: (isAtBottom: boolean) => void;
  handleHighlightVisiblePost: (postId: Id<"schoolClassForumPosts">) => void;
  handleSettledView: (view: ForumConversationView) => void;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isAtLatestEdge: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  lastPostId: Id<"schoolClassForumPosts"> | undefined;
  loadedNewestPostId: Id<"schoolClassForumPosts"> | null;
  loadedOldestPostId: Id<"schoolClassForumPosts"> | null;
  loadNewerPosts: () => boolean;
  loadOlderPosts: () => boolean;
  pendingAnchorRef: RefObject<PendingAnchor | null>;
  pendingHighlightPostId: Id<"schoolClassForumPosts"> | null;
  scheduleMarkRead: {
    (postId: Id<"schoolClassForumPosts">): void;
    cancel: () => void;
    flush: () => void;
  };
  scrollElementRef: RefObject<HTMLDivElement | null>;
  scrollToBottom: (behavior: "auto" | "smooth") => void;
  setShiftBoundaryPostId: (postId: Id<"schoolClassForumPosts"> | null) => void;
  topBoundaryPostIdRef: RefObject<Id<"schoolClassForumPosts"> | null>;
  transcriptVariant: "focused" | "live";
}) {
  const nextIsAtBottom = getConversationBottomDistance(getMetrics()) <= 1;

  handleBottomStateChange(nextIsAtBottom);
  syncHighlightVisibility({
    handleHighlightVisiblePost,
    pendingHighlightPostId,
    scrollElementRef,
  });

  if (
    settleAnchor({ pendingAnchorRef, scrollElementRef }) ||
    continueBottomPin({
      bottomPinRef,
      clearScrollRequest,
      getMetrics,
      scrollToBottom,
    })
  ) {
    return true;
  }

  syncHistoryWindow({
    bottomBoundaryPostIdRef,
    bottomPinRef,
    getMetrics,
    hasMoreAfter,
    hasMoreBefore,
    isLoadingNewer,
    isLoadingOlder,
    loadedNewestPostId,
    loadedOldestPostId,
    loadNewerPosts,
    loadOlderPosts,
    pendingAnchorRef,
    scrollElementRef,
    setShiftBoundaryPostId,
    topBoundaryPostIdRef,
    transcriptVariant,
  });
  persistSettledView({
    getMetrics,
    handleSettledView,
    scrollElementRef,
  });

  if (nextIsAtBottom && isAtLatestEdge && lastPostId) {
    scheduleMarkRead(lastPostId);
    scheduleMarkRead.flush();
    return false;
  }

  scheduleMarkRead.cancel();
  return false;
}
