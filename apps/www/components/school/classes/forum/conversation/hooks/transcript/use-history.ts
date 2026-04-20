"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import {
  FORUM_BOTTOM_PREFETCH_VIEWPORTS,
  FORUM_TOP_PREFETCH_VIEWPORTS,
} from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import {
  getConversationBottomDistance,
  getLoadedPostBoundaries,
} from "@/components/school/classes/forum/conversation/utils/transcript";

interface UseTranscriptHistoryResult {
  resetHistory: () => void;
  shift: boolean;
  syncHistoryWindow: () => void;
}

/** Owns top and bottom history prefetch windows for one mounted transcript shell. */
export function useTranscriptHistory({
  canPrefetchOlderPosts,
  getMetrics,
  hasBufferedOlderPosts,
  hasMoreAfter,
  hasMoreBefore,
  isLoadingNewer,
  items,
  loadNewerPosts,
  loadOlderPosts,
}: {
  canPrefetchOlderPosts: boolean;
  getMetrics: () => {
    scrollHeight: number;
    scrollOffset: number;
    viewportHeight: number;
  };
  hasBufferedOlderPosts: boolean;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isLoadingNewer: boolean;
  items: VirtualItem[];
  loadNewerPosts: () => void;
  loadOlderPosts: () => "committed" | "noop" | "prefetched";
}): UseTranscriptHistoryResult {
  const [pendingPrependBoundary, setPendingPrependBoundary] =
    useState<Id<"schoolClassForumPosts"> | null>(null);
  const newestBoundaryRef = useRef<Id<"schoolClassForumPosts"> | null>(null);
  const oldestBoundaryRef = useRef<Id<"schoolClassForumPosts"> | null>(null);

  /** Clears boundary guards and any pending serialized prepend commit. */
  const resetHistory = useCallback(() => {
    newestBoundaryRef.current = null;
    oldestBoundaryRef.current = null;
    setPendingPrependBoundary(null);
  }, []);

  /** Loads more history once the viewport enters the configured prefetch bands. */
  const syncHistoryWindow = useEffectEvent(() => {
    if (pendingPrependBoundary) {
      return;
    }

    const metrics = getMetrics();

    if (metrics.viewportHeight === 0) {
      return;
    }

    const { newestPostId, oldestPostId } = getLoadedPostBoundaries(items);
    const isInBottomZone =
      getConversationBottomDistance(metrics) <=
      metrics.viewportHeight * FORUM_BOTTOM_PREFETCH_VIEWPORTS;
    const isInTopZone =
      metrics.scrollOffset <=
      metrics.viewportHeight * FORUM_TOP_PREFETCH_VIEWPORTS;

    if (!isInBottomZone) {
      newestBoundaryRef.current = null;
    }

    if (!isInTopZone) {
      oldestBoundaryRef.current = null;
    }

    if (isInTopZone && hasMoreBefore && oldestPostId) {
      if (hasBufferedOlderPosts) {
        setPendingPrependBoundary((current) => current ?? oldestPostId);
        return;
      }

      if (canPrefetchOlderPosts && oldestBoundaryRef.current !== oldestPostId) {
        oldestBoundaryRef.current = oldestPostId;
        loadOlderPosts();
        return;
      }
    }

    if (
      isInBottomZone &&
      hasMoreAfter &&
      newestPostId &&
      !isLoadingNewer &&
      newestBoundaryRef.current !== newestPostId
    ) {
      newestBoundaryRef.current = newestPostId;
      loadNewerPosts();
    }
  });

  useLayoutEffect(() => {
    if (!(pendingPrependBoundary && items.length > 0)) {
      return;
    }

    const result = loadOlderPosts();

    if (result === "committed") {
      return;
    }

    setPendingPrependBoundary(null);
  }, [items.length, loadOlderPosts, pendingPrependBoundary]);

  useLayoutEffect(() => {
    if (
      !(
        pendingPrependBoundary &&
        getLoadedPostBoundaries(items).oldestPostId !== pendingPrependBoundary
      )
    ) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      setPendingPrependBoundary(null);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [items, pendingPrependBoundary]);

  return {
    resetHistory,
    shift: pendingPrependBoundary !== null,
    syncHistoryWindow,
  };
}
