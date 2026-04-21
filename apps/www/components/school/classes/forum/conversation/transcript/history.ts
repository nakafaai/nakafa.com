import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import { syncHighlightVisibility } from "@/components/school/classes/forum/conversation/transcript/settlement";
import type {
  BottomPinState,
  GetTranscriptMetrics,
  PendingAnchor,
  TranscriptMetrics,
} from "@/components/school/classes/forum/conversation/transcript/types";
import {
  FORUM_BOTTOM_PREFETCH_VIEWPORTS,
  FORUM_TOP_PREFETCH_VIEWPORTS,
} from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import {
  captureVisibleConversationDomAnchor,
  getConversationBottomDistance,
} from "@/components/school/classes/forum/conversation/utils/transcript";

/** Loads older/newer history only when the user is near one transcript edge. */
export function syncHistoryWindow({
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
}: {
  bottomBoundaryPostIdRef: RefObject<Id<"schoolClassForumPosts"> | null>;
  bottomPinRef: RefObject<BottomPinState | null>;
  getMetrics: GetTranscriptMetrics;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  loadedNewestPostId: Id<"schoolClassForumPosts"> | null;
  loadedOldestPostId: Id<"schoolClassForumPosts"> | null;
  loadNewerPosts: () => boolean;
  loadOlderPosts: () => boolean;
  pendingAnchorRef: RefObject<PendingAnchor | null>;
  scrollElementRef: RefObject<HTMLDivElement | null>;
  setShiftBoundaryPostId: (postId: Id<"schoolClassForumPosts"> | null) => void;
  topBoundaryPostIdRef: RefObject<Id<"schoolClassForumPosts"> | null>;
  transcriptVariant: "focused" | "live";
}) {
  if (bottomPinRef.current || pendingAnchorRef.current) {
    return;
  }

  const metrics = getMetrics();

  if (metrics.viewportHeight === 0) {
    return;
  }

  const isInBottomZone =
    getConversationBottomDistance(metrics) <=
    metrics.viewportHeight * FORUM_BOTTOM_PREFETCH_VIEWPORTS;
  const isInTopZone =
    metrics.scrollOffset <=
    metrics.viewportHeight * FORUM_TOP_PREFETCH_VIEWPORTS;

  if (!isInBottomZone) {
    bottomBoundaryPostIdRef.current = null;
  }

  if (!isInTopZone) {
    topBoundaryPostIdRef.current = null;
    setShiftBoundaryPostId(null);
  }

  if (
    isInTopZone &&
    hasMoreBefore &&
    loadedOldestPostId &&
    !isLoadingOlder &&
    topBoundaryPostIdRef.current !== loadedOldestPostId
  ) {
    const prependAnchor = scrollElementRef.current
      ? captureVisibleConversationDomAnchor({
          scrollElement: scrollElementRef.current,
        })
      : null;

    if (!loadOlderPosts()) {
      return;
    }

    topBoundaryPostIdRef.current = loadedOldestPostId;
    setShiftBoundaryPostId(loadedOldestPostId);

    if (!prependAnchor) {
      return;
    }

    pendingAnchorRef.current = {
      kind: "post",
      offset: prependAnchor.topWithinScrollRoot,
      postId: prependAnchor.postId,
    };
  }

  if (
    transcriptVariant === "focused" &&
    isInBottomZone &&
    hasMoreAfter &&
    loadedNewestPostId &&
    !isLoadingNewer &&
    bottomBoundaryPostIdRef.current !== loadedNewestPostId
  ) {
    bottomBoundaryPostIdRef.current = loadedNewestPostId;
    loadNewerPosts();
  }
}

/** Handles plain scroll events without forcing a full settle loop. */
export function handleTranscriptScroll({
  bottomBoundaryPostIdRef,
  bottomPinRef,
  getMetrics,
  handleBottomStateChange,
  handleHighlightVisiblePost,
  hasMoreAfter,
  hasMoreBefore,
  isAtLatestEdge,
  isLoadingNewer,
  isLoadingOlder,
  lastPostId,
  latestPinIntentRef,
  loadedNewestPostId,
  loadedOldestPostId,
  loadNewerPosts,
  loadOlderPosts,
  pendingAnchorRef,
  pendingHighlightPostId,
  previousMetricsRef,
  scheduleMarkRead,
  scrollElementRef,
  setShiftBoundaryPostId,
  topBoundaryPostIdRef,
  transcriptVariant,
}: {
  bottomBoundaryPostIdRef: RefObject<Id<"schoolClassForumPosts"> | null>;
  bottomPinRef: RefObject<BottomPinState | null>;
  getMetrics: GetTranscriptMetrics;
  handleBottomStateChange: (isAtBottom: boolean) => void;
  handleHighlightVisiblePost: (postId: Id<"schoolClassForumPosts">) => void;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isAtLatestEdge: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  lastPostId: Id<"schoolClassForumPosts"> | undefined;
  latestPinIntentRef: RefObject<boolean>;
  loadedNewestPostId: Id<"schoolClassForumPosts"> | null;
  loadedOldestPostId: Id<"schoolClassForumPosts"> | null;
  loadNewerPosts: () => boolean;
  loadOlderPosts: () => boolean;
  pendingAnchorRef: RefObject<PendingAnchor | null>;
  pendingHighlightPostId: Id<"schoolClassForumPosts"> | null;
  previousMetricsRef: RefObject<TranscriptMetrics | null>;
  scheduleMarkRead: {
    (postId: Id<"schoolClassForumPosts">): void;
    cancel: () => void;
  };
  scrollElementRef: RefObject<HTMLDivElement | null>;
  setShiftBoundaryPostId: (postId: Id<"schoolClassForumPosts"> | null) => void;
  topBoundaryPostIdRef: RefObject<Id<"schoolClassForumPosts"> | null>;
  transcriptVariant: "focused" | "live";
}) {
  const metrics = getMetrics();
  const nextIsAtBottom = getConversationBottomDistance(metrics) <= 1;
  const previousMetrics = previousMetricsRef.current;
  const didScrollAwayFromLatest =
    previousMetrics !== null &&
    metrics.scrollOffset < previousMetrics.scrollOffset - 1;
  const didViewportGrowWithoutScroll =
    previousMetrics !== null &&
    Math.abs(metrics.scrollOffset - previousMetrics.scrollOffset) <= 1 &&
    metrics.scrollHeight > previousMetrics.scrollHeight + 1;

  handleBottomStateChange(nextIsAtBottom);

  if (!nextIsAtBottom && didScrollAwayFromLatest) {
    latestPinIntentRef.current = false;
  }

  if (nextIsAtBottom && isAtLatestEdge) {
    latestPinIntentRef.current = true;
  }

  if (
    bottomPinRef.current &&
    !(
      transcriptVariant === "live" &&
      isAtLatestEdge &&
      latestPinIntentRef.current &&
      (nextIsAtBottom || didViewportGrowWithoutScroll)
    )
  ) {
    bottomPinRef.current = null;
  }

  if (nextIsAtBottom && isAtLatestEdge && lastPostId) {
    scheduleMarkRead(lastPostId);
  } else {
    scheduleMarkRead.cancel();
  }

  syncHighlightVisibility({
    handleHighlightVisiblePost,
    pendingHighlightPostId,
    scrollElementRef,
  });
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

  previousMetricsRef.current = metrics;
}
