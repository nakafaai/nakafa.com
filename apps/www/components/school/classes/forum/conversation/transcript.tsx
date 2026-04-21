import { useDebouncedCallback } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { VirtualizerHandle } from "virtua";
import { useConversation } from "@/components/school/classes/forum/conversation/provider";
import { scrollToTranscriptBottom } from "@/components/school/classes/forum/conversation/transcript/dom";
import {
  cleanupTranscriptRuntime,
  observeTranscriptResize,
  pinToLatestAfterAppend,
  resetTranscriptViewportState,
  runScrollRequest,
  scheduleTranscriptSettleFrame,
} from "@/components/school/classes/forum/conversation/transcript/effects";
import { handleTranscriptScroll } from "@/components/school/classes/forum/conversation/transcript/history";
import { selectTranscriptModel } from "@/components/school/classes/forum/conversation/transcript/selectors";
import {
  persistSettledView,
  settleTranscriptFrame,
} from "@/components/school/classes/forum/conversation/transcript/settlement";
import type {
  PendingAnchor,
  TranscriptMetrics,
} from "@/components/school/classes/forum/conversation/transcript/types";
import { TranscriptVirtualizer } from "@/components/school/classes/forum/conversation/transcript/virtualizer";
import {
  getConversationScrollMetrics,
  getLoadedPostBoundaries,
} from "@/components/school/classes/forum/conversation/utils/transcript";

const FORUM_MARK_READ_DELAY = 1000;

/** Renders the forum transcript and owns the Virtua + DOM execution boundary. */
export function ForumConversationTranscript() {
  const model = useConversation(selectTranscriptModel);
  const markRead = useMutation(
    api.classes.forums.mutations.readState.markForumRead
  );
  const handleRef = useRef<VirtualizerHandle | null>(null);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const markReadPostIdRef = useRef<Id<"schoolClassForumPosts"> | undefined>(
    undefined
  );
  const pendingAnchorRef = useRef<PendingAnchor | null>(null);
  const latestPinIntentRef = useRef(false);
  const bottomPinRef = useRef<{
    attempts: number;
    requestId: number | null;
  } | null>(null);
  const previousMetricsRef = useRef<TranscriptMetrics | null>(null);
  const settleFrameIdRef = useRef<number | null>(null);
  const previousLastPostIdRef = useRef(model.lastPostId);
  const previousTimelineSessionVersionRef = useRef<number | null>(null);
  const topBoundaryPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(null);
  const bottomBoundaryPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(
    null
  );
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null
  );
  const [shiftBoundaryPostId, setShiftBoundaryPostId] =
    useState<Id<"schoolClassForumPosts"> | null>(null);
  const loadedPostBoundaries = useMemo(
    () => getLoadedPostBoundaries(model.items),
    [model.items]
  );
  const scheduleMarkRead = useDebouncedCallback(
    (nextPostId: Id<"schoolClassForumPosts">) => {
      if (markReadPostIdRef.current === nextPostId) {
        return;
      }

      markRead({ forumId: model.forumId, lastReadPostId: nextPostId }).then(
        () => {
          markReadPostIdRef.current = nextPostId;
        }
      );
    },
    { delay: FORUM_MARK_READ_DELAY, flushOnUnmount: true }
  );

  const setScrollElementRef = useCallback((element: HTMLDivElement | null) => {
    scrollElementRef.current = element;
    setScrollElement(element);
  }, []);

  const getMetrics = useCallback(
    () =>
      getConversationScrollMetrics({
        handle: handleRef.current,
        scrollElement: scrollElementRef.current,
      }),
    []
  );

  const scrollToBottom = useCallback(
    (behavior: "auto" | "smooth") =>
      scrollToTranscriptBottom({
        behavior,
        handleRef,
        scrollElementRef,
      }),
    []
  );

  const settleTranscript = useCallback(
    () =>
      settleTranscriptFrame({
        bottomBoundaryPostIdRef,
        bottomPinRef,
        clearScrollRequest: model.clearScrollRequest,
        getMetrics,
        handleBottomStateChange: model.handleBottomStateChange,
        handleHighlightVisiblePost: model.handleHighlightVisiblePost,
        handleSettledView: model.handleSettledView,
        hasMoreAfter: model.hasMoreAfter,
        hasMoreBefore: model.hasMoreBefore,
        isAtLatestEdge: model.isAtLatestEdge,
        isLoadingNewer: model.isLoadingNewer,
        isLoadingOlder: model.isLoadingOlder,
        lastPostId: model.lastPostId,
        loadedNewestPostId: loadedPostBoundaries.newestPostId,
        loadedOldestPostId: loadedPostBoundaries.oldestPostId,
        loadNewerPosts: model.loadNewerPosts,
        loadOlderPosts: model.loadOlderPosts,
        pendingAnchorRef,
        pendingHighlightPostId: model.pendingHighlightPostId,
        scheduleMarkRead,
        scrollElementRef,
        scrollToBottom,
        setShiftBoundaryPostId,
        topBoundaryPostIdRef,
        transcriptVariant: model.transcriptVariant,
      }),
    [getMetrics, loadedPostBoundaries, model, scheduleMarkRead, scrollToBottom]
  );

  const scheduleSettleFrame = useCallback(
    () =>
      scheduleTranscriptSettleFrame({
        settleFrameIdRef,
        settleTranscript,
      }),
    [settleTranscript]
  );
  const scheduleScrollSettle = useDebouncedCallback(
    () => {
      scheduleSettleFrame();
    },
    { delay: 120 }
  );

  const handleScroll = useCallback(() => {
    handleTranscriptScroll({
      bottomBoundaryPostIdRef,
      bottomPinRef,
      getMetrics,
      handleBottomStateChange: model.handleBottomStateChange,
      handleHighlightVisiblePost: model.handleHighlightVisiblePost,
      hasMoreAfter: model.hasMoreAfter,
      hasMoreBefore: model.hasMoreBefore,
      isAtLatestEdge: model.isAtLatestEdge,
      isLoadingNewer: model.isLoadingNewer,
      isLoadingOlder: model.isLoadingOlder,
      lastPostId: model.lastPostId,
      latestPinIntentRef,
      loadedNewestPostId: loadedPostBoundaries.newestPostId,
      loadedOldestPostId: loadedPostBoundaries.oldestPostId,
      loadNewerPosts: model.loadNewerPosts,
      loadOlderPosts: model.loadOlderPosts,
      pendingAnchorRef,
      pendingHighlightPostId: model.pendingHighlightPostId,
      previousMetricsRef,
      scheduleMarkRead,
      scrollElementRef,
      setShiftBoundaryPostId,
      topBoundaryPostIdRef,
      transcriptVariant: model.transcriptVariant,
    });
    scheduleScrollSettle();
  }, [
    getMetrics,
    loadedPostBoundaries,
    model,
    scheduleMarkRead,
    scheduleScrollSettle,
  ]);

  useLayoutEffect(() => {
    const previousVersion = previousTimelineSessionVersionRef.current;

    previousTimelineSessionVersionRef.current = model.timelineSessionVersion;

    if (
      previousVersion === null ||
      previousVersion === model.timelineSessionVersion
    ) {
      return;
    }

    resetTranscriptViewportState({
      bottomBoundaryPostIdRef,
      bottomPinRef,
      pendingAnchorRef,
      setShiftBoundaryPostId,
      topBoundaryPostIdRef,
    });
  }, [model.timelineSessionVersion]);

  useLayoutEffect(() => {
    if (!scrollElement) {
      return;
    }

    previousMetricsRef.current = getMetrics();
  }, [getMetrics, scrollElement]);

  useLayoutEffect(() => {
    if (
      shiftBoundaryPostId &&
      loadedPostBoundaries.oldestPostId !== shiftBoundaryPostId
    ) {
      scheduleSettleFrame();
    }
  }, [
    loadedPostBoundaries.oldestPostId,
    scheduleSettleFrame,
    shiftBoundaryPostId,
  ]);

  useLayoutEffect(() => {
    if (!scrollElement) {
      return;
    }

    runScrollRequest({
      bottomPinRef,
      clearScrollRequest: model.clearScrollRequest,
      itemsLength: model.items.length,
      latestPinIntentRef,
      pendingAnchorRef,
      postIdToIndex: model.postIdToIndex,
      scheduleSettleFrame,
      scrollRequest: model.scrollRequest,
      scrollToBottom,
      transcriptVariant: model.transcriptVariant,
      virtualizer: handleRef.current,
    });
  }, [model, scheduleSettleFrame, scrollElement, scrollToBottom]);

  useLayoutEffect(() => {
    pinToLatestAfterAppend({
      bottomPinRef,
      latestPinIntentRef,
      isAtBottom: model.isAtBottom,
      isAtLatestEdge: model.isAtLatestEdge,
      lastPostId: model.lastPostId,
      previousLastPostIdRef,
      scheduleSettleFrame,
      scrollToBottom,
    });
  }, [
    model.isAtBottom,
    model.isAtLatestEdge,
    model.lastPostId,
    scheduleSettleFrame,
    scrollToBottom,
  ]);

  useLayoutEffect(
    () =>
      observeTranscriptResize({
        bottomPinRef,
        latestPinIntentRef,
        shouldPinToLatest:
          model.transcriptVariant === "live" && model.isAtLatestEdge,
        pendingAnchorRef,
        scheduleSettleFrame,
        scrollElement,
      }),
    [
      model.isAtLatestEdge,
      model.transcriptVariant,
      scheduleSettleFrame,
      scrollElement,
    ]
  );

  useLayoutEffect(
    () => () => {
      scheduleScrollSettle.cancel();
      cleanupTranscriptRuntime({
        persistSettledView: () => {
          persistSettledView({
            getMetrics,
            handleSettledView: model.handleSettledView,
            scrollElementRef,
          });
        },
        scheduleMarkRead,
        settleFrameIdRef,
      });
    },
    [
      getMetrics,
      model.handleSettledView,
      scheduleMarkRead,
      scheduleScrollSettle,
    ]
  );

  return (
    <TranscriptVirtualizer
      handleRef={handleRef}
      highlightedPostId={model.highlightedPostId}
      items={model.items}
      onScroll={handleScroll}
      onScrollEnd={settleTranscript}
      scrollElementRef={scrollElementRef}
      setScrollElementRef={setScrollElementRef}
      shiftEnabled={shiftBoundaryPostId !== null}
    />
  );
}
