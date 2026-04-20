"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import { useCallback, useRef } from "react";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import {
  getForumPrefetchDistance,
  shouldRequestHistoryBoundary,
} from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import {
  captureVisibleConversationAnchor,
  getLoadedPostBoundaries,
} from "@/components/school/classes/forum/conversation/utils/transcript";

interface UseTranscriptHistoryResult {
  maybeRequestHistory: (scrollOffset: number) => void;
  pendingOlderAnchorRef: RefObject<{
    offset: number;
    postId: Id<"schoolClassForumPosts">;
  } | null>;
  previousScrollOffsetRef: RefObject<number>;
  resetHistoryState: () => void;
}

interface HistoryOptions {
  getDistanceFromBottom: () => number;
  getScrollMetrics: () => {
    scrollOffset: number;
    viewportBottom: number;
    viewportHeight: number;
  };
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  items: VirtualItem[];
  loadNewerPosts: () => void;
  loadOlderPosts: () => void;
  virtualItems: Array<{
    end: number;
    index: number;
    key: bigint | number | string;
    start: number;
  }>;
}

/** Owns history boundary requests and prepend anchor preservation state. */
export function useTranscriptHistory({
  getDistanceFromBottom,
  getScrollMetrics,
  hasMoreAfter,
  hasMoreBefore,
  isLoadingNewer,
  isLoadingOlder,
  items,
  loadNewerPosts,
  loadOlderPosts,
  virtualItems,
}: HistoryOptions): UseTranscriptHistoryResult {
  const pendingOlderAnchorRef = useRef<{
    offset: number;
    postId: Id<"schoolClassForumPosts">;
  } | null>(null);
  const lastRequestedNewerBoundaryRef =
    useRef<Id<"schoolClassForumPosts"> | null>(null);
  const lastRequestedOlderBoundaryRef =
    useRef<Id<"schoolClassForumPosts"> | null>(null);
  const previousScrollOffsetRef = useRef(0);

  const requestOlderBoundary = useCallback(
    (boundaryPostId: Id<"schoolClassForumPosts"> | null) => {
      if (
        !shouldRequestHistoryBoundary({
          boundaryPostId,
          hasMore: hasMoreBefore,
          isLoading: isLoadingOlder,
          lastRequestedBoundaryPostId: lastRequestedOlderBoundaryRef.current,
        })
      ) {
        return;
      }

      const { scrollOffset, viewportBottom } = getScrollMetrics();

      lastRequestedOlderBoundaryRef.current = boundaryPostId;
      pendingOlderAnchorRef.current = captureVisibleConversationAnchor({
        items,
        scrollOffset,
        viewportBottom,
        virtualItems,
      });
      loadOlderPosts();
    },
    [
      getScrollMetrics,
      hasMoreBefore,
      isLoadingOlder,
      items,
      loadOlderPosts,
      virtualItems,
    ]
  );

  const requestNewerBoundary = useCallback(
    (boundaryPostId: Id<"schoolClassForumPosts"> | null) => {
      if (
        !shouldRequestHistoryBoundary({
          boundaryPostId,
          hasMore: hasMoreAfter,
          isLoading: isLoadingNewer,
          lastRequestedBoundaryPostId: lastRequestedNewerBoundaryRef.current,
        })
      ) {
        return;
      }

      lastRequestedNewerBoundaryRef.current = boundaryPostId;
      loadNewerPosts();
    },
    [hasMoreAfter, isLoadingNewer, loadNewerPosts]
  );

  const maybeRequestHistory = useCallback(
    (scrollOffset: number) => {
      const { viewportHeight } = getScrollMetrics();
      const prefetchDistance = getForumPrefetchDistance(viewportHeight);
      const isMovingUp = scrollOffset < previousScrollOffsetRef.current;
      const isMovingDown = scrollOffset > previousScrollOffsetRef.current;
      const isNearTop = scrollOffset <= prefetchDistance;
      const isNearBottom = getDistanceFromBottom() <= prefetchDistance;
      const { newestPostId, oldestPostId } = getLoadedPostBoundaries(items);

      if (isNearTop && isMovingUp) {
        requestOlderBoundary(oldestPostId);
      }

      if (isNearBottom && isMovingDown) {
        requestNewerBoundary(newestPostId);
      }
    },
    [
      getDistanceFromBottom,
      getScrollMetrics,
      items,
      requestNewerBoundary,
      requestOlderBoundary,
    ]
  );

  const resetHistoryState = useCallback(() => {
    pendingOlderAnchorRef.current = null;
    lastRequestedOlderBoundaryRef.current = null;
    lastRequestedNewerBoundaryRef.current = null;
    previousScrollOffsetRef.current = 0;
  }, []);

  return {
    maybeRequestHistory,
    pendingOlderAnchorRef,
    previousScrollOffsetRef,
    resetHistoryState,
  };
}
