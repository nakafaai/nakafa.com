import { usePrevious } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type RefObject, useCallback, useLayoutEffect } from "react";
import type { VirtualizerHandle } from "virtua";
import { useTranscriptAnchor } from "@/components/school/classes/forum/conversation/hooks/transcript/use-anchor";
import { useTranscriptBottom } from "@/components/school/classes/forum/conversation/hooks/transcript/use-bottom";
import { useTranscriptCommand } from "@/components/school/classes/forum/conversation/hooks/transcript/use-command";
import { useTranscriptHistory } from "@/components/school/classes/forum/conversation/hooks/transcript/use-history";
import { useTranscriptSettled } from "@/components/school/classes/forum/conversation/hooks/transcript/use-settled";
import { useTranscriptShell } from "@/components/school/classes/forum/conversation/hooks/transcript/use-shell";
import { useConversation } from "@/components/school/classes/forum/conversation/provider";

interface TranscriptController {
  handleRef: RefObject<VirtualizerHandle | null>;
  handleScroll: (offset: number) => void;
  handleScrollEnd: () => void;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  items: ReturnType<typeof useConversationItems>;
  scrollElementRef: RefObject<HTMLDivElement | null>;
  setScrollElementRef: (element: HTMLDivElement | null) => void;
  shift: boolean;
}

/** Returns the current transcript rows from selector context. */
function useConversationItems() {
  return useConversation((value) => value.state.items);
}

/** Owns one feature-local Virtua transcript runtime. */
export function useTranscript(): TranscriptController {
  const canPrefetchOlderPosts = useConversation(
    (value) => value.state.canPrefetchOlderPosts
  );
  const command = useConversation((value) => value.state.command);
  const hasBufferedOlderPosts = useConversation(
    (value) => value.state.hasBufferedOlderPosts
  );
  const hasMoreAfter = useConversation((value) => value.state.hasMoreAfter);
  const hasMoreBefore = useConversation((value) => value.state.hasMoreBefore);
  const highlightedPostId = useConversation(
    (value) => value.state.highlightedPostId
  );
  const isAtLatestEdge = useConversation((value) => value.state.isAtLatestEdge);
  const isLoadingNewer = useConversation((value) => value.state.isLoadingNewer);
  const items = useConversationItems();
  const lastPostId = useConversation((value) => value.state.lastPostId);
  const latestConversationView = useConversation(
    (value) => value.state.latestConversationView
  );
  const mode = useConversation((value) => value.state.mode);
  const pendingHighlightPostId = useConversation(
    (value) => value.state.pendingHighlightPostId
  );
  const postIdToIndex = useConversation((value) => value.state.postIdToIndex);
  const timelineSessionVersion = useConversation(
    (value) => value.state.timelineSessionVersion
  );
  const unreadPostId = useConversation((value) => value.state.unreadPostId);
  const cancelPendingMarkRead = useConversation(
    (value) => value.actions.cancelPendingMarkRead
  );
  const flushMarkRead = useConversation((value) => value.actions.flushMarkRead);
  const handleBottomStateChange = useConversation(
    (value) => value.actions.handleBottomStateChange
  );
  const handleCommandResult = useConversation(
    (value) => value.actions.handleCommandResult
  );
  const handleHighlightVisiblePost = useConversation(
    (value) => value.actions.handleHighlightVisiblePost
  );
  const handleSettledView = useConversation(
    (value) => value.actions.handleSettledView
  );
  const loadNewerPosts = useConversation(
    (value) => value.actions.loadNewerPosts
  );
  const loadOlderPosts = useConversation(
    (value) => value.actions.loadOlderPosts
  );
  const scheduleMarkRead = useConversation(
    (value) => value.actions.scheduleMarkRead
  );
  const previousLastPostId = usePrevious(lastPostId);
  const previousTimelineSessionVersion = usePrevious(timelineSessionVersion);
  const {
    getMetrics,
    handleRef,
    scrollElement,
    scrollElementRef,
    setScrollElementRef,
  } = useTranscriptShell();

  const {
    armBottomPin,
    isBottomPinArmed,
    resetBottomPin,
    scrollToBottom,
    syncBottomState,
  } = useTranscriptBottom({
    getMetrics,
    handleBottomStateChange,
    handleRef,
    scrollElementRef,
  });
  const { persistSettledView, reportScrollSettled } = useTranscriptSettled({
    getMetrics,
    handleSettledView,
    scrollElementRef,
  });
  const { resetAnchor, scrollToView, syncHighlightVisibility } =
    useTranscriptAnchor({
      handleHighlightVisiblePost,
      handleRef,
      pendingHighlightPostId,
      postIdToIndex,
      scrollElementRef,
    });
  const { resetHistory, shift, syncHistoryWindow } = useTranscriptHistory({
    canPrefetchOlderPosts,
    getMetrics,
    hasBufferedOlderPosts,
    hasMoreAfter,
    hasMoreBefore,
    isLoadingNewer,
    items,
    loadNewerPosts,
    loadOlderPosts,
  });
  const { resetCommand } = useTranscriptCommand({
    armBottomPin,
    command,
    handleCommandResult,
    isAtLatestEdge,
    items,
    latestConversationView,
    mode,
    scrollToBottom,
    scrollToView,
    timelineSessionVersion,
    unreadPostId,
  });

  /** Handles one scroll offset change from Virtua. */
  const handleScroll = useCallback(() => {
    const isAtBottom = syncBottomState();

    if (isAtBottom && isAtLatestEdge) {
      scheduleMarkRead(lastPostId);
    } else {
      cancelPendingMarkRead();
    }

    syncHighlightVisibility();
    syncHistoryWindow();
    reportScrollSettled();
  }, [
    cancelPendingMarkRead,
    isAtLatestEdge,
    lastPostId,
    reportScrollSettled,
    scheduleMarkRead,
    syncBottomState,
    syncHighlightVisibility,
    syncHistoryWindow,
  ]);

  /** Handles one settled scroll frame from Virtua. */
  const handleScrollEnd = useCallback(() => {
    syncBottomState();
    syncHighlightVisibility();
    syncHistoryWindow();
    persistSettledView();
  }, [
    persistSettledView,
    syncBottomState,
    syncHighlightVisibility,
    syncHistoryWindow,
  ]);

  useLayoutEffect(() => {
    if (
      previousTimelineSessionVersion === undefined ||
      previousTimelineSessionVersion === timelineSessionVersion
    ) {
      return;
    }

    resetCommand();
    resetAnchor();
    resetBottomPin();
    resetHistory();
    reportScrollSettled.cancel();
  }, [
    previousTimelineSessionVersion,
    reportScrollSettled,
    resetAnchor,
    resetBottomPin,
    resetCommand,
    resetHistory,
    timelineSessionVersion,
  ]);

  useLayoutEffect(() => {
    if (!scrollElement) {
      return;
    }

    syncBottomState();

    if (pendingHighlightPostId) {
      syncHighlightVisibility();
    }

    if (
      items.length > 0 &&
      (canPrefetchOlderPosts ||
        hasBufferedOlderPosts ||
        hasMoreAfter ||
        hasMoreBefore ||
        isLoadingNewer)
    ) {
      syncHistoryWindow();
    }
  }, [
    canPrefetchOlderPosts,
    hasBufferedOlderPosts,
    hasMoreAfter,
    hasMoreBefore,
    isLoadingNewer,
    items,
    pendingHighlightPostId,
    scrollElement,
    syncBottomState,
    syncHighlightVisibility,
    syncHistoryWindow,
  ]);

  useLayoutEffect(() => {
    if (
      !(
        isAtLatestEdge &&
        lastPostId &&
        previousLastPostId &&
        lastPostId !== previousLastPostId
      )
    ) {
      return;
    }

    if (isBottomPinArmed()) {
      scrollToBottom("auto");
    }

    if (syncBottomState()) {
      flushMarkRead(lastPostId);
    }
  }, [
    flushMarkRead,
    isAtLatestEdge,
    isBottomPinArmed,
    lastPostId,
    previousLastPostId,
    scrollToBottom,
    syncBottomState,
  ]);

  useLayoutEffect(
    () => () => {
      cancelPendingMarkRead();
      resetAnchor();
      reportScrollSettled.cancel();
      persistSettledView();
    },
    [
      cancelPendingMarkRead,
      persistSettledView,
      reportScrollSettled,
      resetAnchor,
    ]
  );

  return {
    handleRef,
    handleScroll,
    handleScrollEnd,
    highlightedPostId,
    items,
    scrollElementRef,
    setScrollElementRef,
    shift,
  };
}
