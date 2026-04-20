"use client";

import { useDebouncedCallback } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";
import { useCallback } from "react";
import { useTranscriptBottom } from "@/components/school/classes/forum/conversation/hooks/transcript/use-bottom";
import { useTranscriptSettled } from "@/components/school/classes/forum/conversation/hooks/transcript/use-settled";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import {
  captureVisibleConversationAnchor,
  getConversationBottomDistance,
  getTranscriptScrollMetrics,
  isConversationPostVisible,
} from "@/components/school/classes/forum/conversation/utils/transcript";
import type { ForumConversationView } from "@/lib/store/forum";

const FORUM_SCROLL_SETTLE_DELAY = 80;

type ScrollBehavior = "auto" | "smooth";
type ScrollAlignment = "center" | "start";
type TranscriptView = Extract<ForumConversationView, { kind: "post" }>;
type TranscriptVirtualizer = Virtualizer<HTMLDivElement, HTMLDivElement>;
type TranscriptDebouncedAction = (() => void) & { cancel: () => void };

interface TranscriptScrollMetrics {
  scrollOffset: number;
  viewportBottom: number;
  viewportHeight: number;
}

interface UseTranscriptViewResult {
  captureCurrentConversationView: () => ForumConversationView | null;
  getDistanceFromBottom: () => number;
  getScrollMetrics: () => TranscriptScrollMetrics;
  getScrollOffsetForView: ({
    align,
    view,
  }: {
    align: ScrollAlignment;
    view: TranscriptView;
  }) => number | null;
  handleScrollSettled: TranscriptDebouncedAction;
  highlightVisiblePost: (
    postId: Id<"schoolClassForumPosts"> | null | undefined
  ) => void;
  isAtTranscriptBottom: () => boolean;
  isBottomPinnedRef: RefObject<boolean>;
  latestViewRef: RefObject<ForumConversationView | null>;
  pendingBottomPersistenceRef: RefObject<boolean>;
  pendingBottomPinRef: RefObject<boolean>;
  reportSettled: (view: ForumConversationView) => void;
  resetView: () => void;
  scrollToBottom: (behavior: ScrollBehavior) => void;
  scrollToView: ({
    align,
    behavior,
    view,
  }: {
    align: ScrollAlignment;
    behavior: ScrollBehavior;
    view: TranscriptView;
  }) => boolean;
  syncBottom: () => boolean;
}

interface ViewOptions {
  cancelPendingMarkRead: () => void;
  handleBottomStateChange: (nextIsAtBottom: boolean) => void;
  handleHighlightVisiblePost: (postId: Id<"schoolClassForumPosts">) => void;
  handleSettledView: (view: ForumConversationView) => void;
  isAtLatestEdge: boolean;
  items: VirtualItem[];
  lastPostId: Id<"schoolClassForumPosts"> | undefined;
  latestConversationView: ForumConversationView | null;
  pendingHighlightPostId: Id<"schoolClassForumPosts"> | null;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  scheduleMarkRead: (
    lastReadPostId: Id<"schoolClassForumPosts"> | undefined
  ) => void;
  scrollElementRef: RefObject<HTMLDivElement | null>;
  virtualItems: Array<{
    end: number;
    index: number;
    start: number;
  }>;
  virtualizer: TranscriptVirtualizer;
}

/** Owns scroll metrics, semantic view capture, bottom pinning, and settled persistence. */
export function useTranscriptView({
  cancelPendingMarkRead,
  handleBottomStateChange,
  handleHighlightVisiblePost,
  handleSettledView,
  isAtLatestEdge,
  items,
  lastPostId,
  latestConversationView,
  pendingHighlightPostId,
  postIdToIndex,
  scheduleMarkRead,
  scrollElementRef,
  virtualItems,
  virtualizer,
}: ViewOptions): UseTranscriptViewResult {
  const { latestViewRef, reportSettled } = useTranscriptSettled({
    handleSettledView,
    latestConversationView,
  });

  const getScrollMetrics = useCallback(
    () =>
      getTranscriptScrollMetrics({
        fallbackClientHeight: scrollElementRef.current?.clientHeight,
        fallbackScrollTop: scrollElementRef.current?.scrollTop,
        scrollOffset: virtualizer.scrollOffset,
        scrollRectHeight: virtualizer.scrollRect?.height,
      }),
    [scrollElementRef, virtualizer]
  );

  const getDistanceFromBottom = useCallback(() => {
    const { scrollOffset, viewportHeight } = getScrollMetrics();

    return getConversationBottomDistance({
      scrollOffset,
      totalSize: virtualizer.getTotalSize(),
      viewportHeight,
    });
  }, [getScrollMetrics, virtualizer]);

  const {
    isAtTranscriptBottom,
    isBottomPinnedRef,
    pendingBottomPersistenceRef,
    pendingBottomPinRef,
    resetBottom,
    syncBottom,
  } = useTranscriptBottom({
    getDistanceFromBottom,
    handleBottomChange: handleBottomStateChange,
  });

  const getScrollOffsetForView = useCallback(
    ({ align, view }: { align: ScrollAlignment; view: TranscriptView }) => {
      const index = postIdToIndex.get(view.postId);

      if (index === undefined) {
        return null;
      }

      const offsetInfo = virtualizer.getOffsetForIndex(index, align);

      if (!offsetInfo) {
        return null;
      }

      const [offset] = offsetInfo;

      if (align === "center") {
        return offset;
      }

      return Math.max(0, offset - view.offset);
    },
    [postIdToIndex, virtualizer]
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior) => {
      const lastItemIndex = items.length - 1;

      if (lastItemIndex < 0) {
        return;
      }

      virtualizer.scrollToIndex(lastItemIndex, {
        align: "end",
        behavior,
      });
    },
    [items.length, virtualizer]
  );

  const scrollToView = useCallback(
    ({
      align,
      behavior,
      view,
    }: {
      align: ScrollAlignment;
      behavior: ScrollBehavior;
      view: TranscriptView;
    }) => {
      const targetOffset = getScrollOffsetForView({
        align,
        view,
      });

      if (targetOffset === null) {
        return false;
      }

      virtualizer.scrollToOffset(targetOffset, { behavior });
      return true;
    },
    [getScrollOffsetForView, virtualizer]
  );

  const captureCurrentConversationView = useCallback(() => {
    if (isAtTranscriptBottom()) {
      return { kind: "bottom" } satisfies ForumConversationView;
    }

    const { scrollOffset, viewportBottom } = getScrollMetrics();
    const anchor = captureVisibleConversationAnchor({
      items,
      scrollOffset,
      viewportBottom,
      virtualItems,
    });

    if (!anchor) {
      return null;
    }

    return {
      kind: "post",
      offset: anchor.offset,
      postId: anchor.postId,
    } satisfies ForumConversationView;
  }, [getScrollMetrics, isAtTranscriptBottom, items, virtualItems]);

  const isPostVisible = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      const { scrollOffset, viewportBottom } = getScrollMetrics();

      return isConversationPostVisible({
        postId,
        postIdToIndex,
        scrollOffset,
        viewportBottom,
        virtualItems,
      });
    },
    [getScrollMetrics, postIdToIndex, virtualItems]
  );

  const maybeHighlightVisiblePost = useCallback(() => {
    if (!(pendingHighlightPostId && isPostVisible(pendingHighlightPostId))) {
      return;
    }

    handleHighlightVisiblePost(pendingHighlightPostId);
  }, [handleHighlightVisiblePost, isPostVisible, pendingHighlightPostId]);

  const highlightVisiblePost = useCallback(
    (postId: Id<"schoolClassForumPosts"> | null | undefined) => {
      if (!(postId && isPostVisible(postId))) {
        return;
      }

      handleHighlightVisiblePost(postId);
    },
    [handleHighlightVisiblePost, isPostVisible]
  );

  const handleScrollSettled: TranscriptDebouncedAction = useDebouncedCallback(
    () => {
      const atBottom = syncBottom();

      if (pendingBottomPersistenceRef.current) {
        if (!(atBottom && isAtLatestEdge)) {
          return;
        }

        pendingBottomPersistenceRef.current = false;
        reportSettled({ kind: "bottom" });
      } else {
        const currentView = captureCurrentConversationView();

        if (currentView) {
          reportSettled(currentView);
        }
      }

      maybeHighlightVisiblePost();

      if (atBottom && isAtLatestEdge) {
        scheduleMarkRead(lastPostId);
      } else {
        cancelPendingMarkRead();
      }
    },
    FORUM_SCROLL_SETTLE_DELAY
  );

  const resetView = useCallback(() => {
    resetBottom();
  }, [resetBottom]);

  return {
    captureCurrentConversationView,
    getDistanceFromBottom,
    highlightVisiblePost,
    getScrollMetrics,
    getScrollOffsetForView,
    handleScrollSettled,
    isAtTranscriptBottom,
    isBottomPinnedRef,
    latestViewRef,
    pendingBottomPersistenceRef,
    pendingBottomPinRef,
    reportSettled,
    resetView,
    scrollToBottom,
    scrollToView,
    syncBottom,
  };
}
