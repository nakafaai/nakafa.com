"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";
import { useCallback, useMemo, useRef } from "react";
import { useTranscriptHistory } from "@/components/school/classes/forum/conversation/hooks/transcript/use-history";
import { useTranscriptView } from "@/components/school/classes/forum/conversation/hooks/transcript/use-view";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import {
  estimateConversationItemSize,
  getConversationItemKey,
  measureConversationItemSize,
} from "@/components/school/classes/forum/conversation/utils/transcript";
import type { ForumConversationView } from "@/lib/store/forum";

type ScrollBehavior = "auto" | "smooth";
type ScrollAlignment = "center" | "start";
type TranscriptView = Extract<ForumConversationView, { kind: "post" }>;

interface TranscriptVirtualItem {
  end: number;
  index: number;
  key: bigint | number | string;
  start: number;
}

type TranscriptVirtualizer = Virtualizer<HTMLDivElement, HTMLDivElement>;

export interface ConversationTranscriptRuntime {
  captureCurrentConversationView: () => ForumConversationView | null;
  getScrollOffsetForView: ({
    align,
    view,
  }: {
    align: ScrollAlignment;
    view: TranscriptView;
  }) => number | null;
  handleScrollSettled: (() => void) & { cancel: () => void };
  highlightVisiblePost: (
    postId: Id<"schoolClassForumPosts"> | null | undefined
  ) => void;
  isAtTranscriptBottom: () => boolean;
  isBottomPinnedRef: RefObject<boolean>;
  latestViewRef: RefObject<ForumConversationView | null>;
  pendingBottomPersistenceRef: RefObject<boolean>;
  pendingBottomPinRef: RefObject<boolean>;
  pendingOlderAnchorRef: RefObject<{
    offset: number;
    postId: Id<"schoolClassForumPosts">;
  } | null>;
  previousScrollOffsetRef: RefObject<number>;
  reportSettled: (view: ForumConversationView) => void;
  resetSessionState: () => void;
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
  virtualizer: TranscriptVirtualizer;
}

interface UseTranscriptVirtualizerResult {
  measureElement: TranscriptVirtualizer["measureElement"];
  runtime: ConversationTranscriptRuntime;
  scrollElementRef: RefObject<HTMLDivElement | null>;
  totalSize: number;
  translateY: number;
  virtualItems: TranscriptVirtualItem[];
}

interface TranscriptModel {
  cancelPendingMarkRead: () => void;
  handleBottomStateChange: (nextIsAtBottom: boolean) => void;
  handleHighlightVisiblePost: (postId: Id<"schoolClassForumPosts">) => void;
  handleSettledView: (view: ForumConversationView) => void;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  isAtLatestEdge: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  items: VirtualItem[];
  lastPostId: Id<"schoolClassForumPosts"> | undefined;
  latestConversationView: ForumConversationView | null;
  loadNewerPosts: () => void;
  loadOlderPosts: () => void;
  pendingHighlightPostId: Id<"schoolClassForumPosts"> | null;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  scheduleMarkRead: (
    lastReadPostId: Id<"schoolClassForumPosts"> | undefined
  ) => void;
}

/** Owns the TanStack virtualizer instance and composes feature-local viewport/history state. */
export function useTranscriptVirtualizer({
  cancelPendingMarkRead,
  handleBottomStateChange,
  handleHighlightVisiblePost,
  handleSettledView,
  items,
  latestConversationView,
  ...props
}: TranscriptModel): UseTranscriptVirtualizerResult {
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const itemKeys = useMemo(
    () => items.map((item) => getConversationItemKey(item)),
    [items]
  );
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: items.length,
    estimateSize: (index) => estimateConversationItemSize(items[index]),
    getItemKey: (index) => itemKeys[index] ?? index,
    getScrollElement: () => scrollElementRef.current,
    measureElement: measureConversationItemSize,
    overscan: 6,
    useFlushSync: false,
    onChange: (instance) => {
      const scrollOffset = instance.scrollOffset ?? 0;
      const atBottom = viewState.syncBottom();

      historyState.maybeRequestHistory(scrollOffset);

      if (atBottom && props.isAtLatestEdge) {
        props.scheduleMarkRead(props.lastPostId);
      } else {
        cancelPendingMarkRead();
      }

      historyState.previousScrollOffsetRef.current = scrollOffset;

      viewState.handleScrollSettled();
    },
  });
  const virtualItems: TranscriptVirtualItem[] = virtualizer.getVirtualItems();
  const viewState = useTranscriptView({
    cancelPendingMarkRead,
    handleBottomStateChange,
    handleHighlightVisiblePost,
    handleSettledView,
    isAtLatestEdge: props.isAtLatestEdge,
    items,
    lastPostId: props.lastPostId,
    latestConversationView,
    pendingHighlightPostId: props.pendingHighlightPostId,
    postIdToIndex: props.postIdToIndex,
    scheduleMarkRead: props.scheduleMarkRead,
    scrollElementRef,
    virtualItems,
    virtualizer,
  });
  const historyState = useTranscriptHistory({
    getDistanceFromBottom: viewState.getDistanceFromBottom,
    getScrollMetrics: viewState.getScrollMetrics,
    hasMoreAfter: props.hasMoreAfter,
    hasMoreBefore: props.hasMoreBefore,
    isLoadingNewer: props.isLoadingNewer,
    isLoadingOlder: props.isLoadingOlder,
    items,
    loadNewerPosts: props.loadNewerPosts,
    loadOlderPosts: props.loadOlderPosts,
    virtualItems,
  });

  const resetSessionState = useCallback(() => {
    historyState.resetHistoryState();
    viewState.resetView();
  }, [historyState, viewState]);

  const runtime: ConversationTranscriptRuntime = {
    captureCurrentConversationView: viewState.captureCurrentConversationView,
    getScrollOffsetForView: viewState.getScrollOffsetForView,
    handleScrollSettled: viewState.handleScrollSettled,
    highlightVisiblePost: viewState.highlightVisiblePost,
    isAtTranscriptBottom: viewState.isAtTranscriptBottom,
    isBottomPinnedRef: viewState.isBottomPinnedRef,
    latestViewRef: viewState.latestViewRef,
    pendingBottomPersistenceRef: viewState.pendingBottomPersistenceRef,
    pendingBottomPinRef: viewState.pendingBottomPinRef,
    pendingOlderAnchorRef: historyState.pendingOlderAnchorRef,
    previousScrollOffsetRef: historyState.previousScrollOffsetRef,
    reportSettled: viewState.reportSettled,
    resetSessionState,
    scrollToBottom: viewState.scrollToBottom,
    scrollToView: viewState.scrollToView,
    virtualizer,
  };

  return {
    measureElement: virtualizer.measureElement,
    runtime,
    scrollElementRef,
    totalSize: virtualizer.getTotalSize(),
    translateY: virtualItems[0]?.start ?? 0,
    virtualItems,
  };
}
