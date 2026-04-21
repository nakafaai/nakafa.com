import { useDebouncedCallback } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Virtualizer, type VirtualizerHandle } from "virtua";
import { ForumHeader } from "@/components/school/classes/forum/conversation/header";
import { ForumPostItem } from "@/components/school/classes/forum/conversation/item";
import { useConversation } from "@/components/school/classes/forum/conversation/provider";
import {
  DateSeparator,
  UnreadSeparator,
} from "@/components/school/classes/forum/conversation/separators";
import type { ForumConversationView } from "@/components/school/classes/forum/conversation/store/forum";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import {
  FORUM_BOTTOM_PREFETCH_VIEWPORTS,
  FORUM_TOP_PREFETCH_VIEWPORTS,
  FORUM_VIRTUAL_BUFFER_SIZE,
} from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import {
  captureVisibleConversationDomAnchor,
  getConversationBottomDistance,
  getConversationItemKey,
  getConversationScrollMetrics,
  getLoadedPostBoundaries,
  isConversationPostVisibleInDom,
  reconcileConversationDomAnchor,
} from "@/components/school/classes/forum/conversation/utils/transcript";

const FORUM_BOTTOM_PIN_RETRIES = 12;
const FORUM_MARK_READ_DELAY = 1000;

/** Renders the forum transcript and owns the only DOM/Virtua runtime boundary. */
export function ForumConversationTranscript() {
  const forumId = useConversation((state) => state.forumId);
  const clearScrollRequest = useConversation(
    (state) => state.clearScrollRequest
  );
  const handleBottomStateChange = useConversation(
    (state) => state.handleBottomStateChange
  );
  const handleHighlightVisiblePost = useConversation(
    (state) => state.handleHighlightVisiblePost
  );
  const handleSettledView = useConversation((state) => state.handleSettledView);
  const hasMoreAfter = useConversation((state) => state.hasMoreAfter);
  const hasMoreBefore = useConversation((state) => state.hasMoreBefore);
  const highlightedPostId = useConversation((state) => state.highlightedPostId);
  const isAtBottom = useConversation((state) => state.isAtBottom);
  const isAtLatestEdge = useConversation((state) => state.isAtLatestEdge);
  const isLoadingNewer = useConversation((state) => state.isLoadingNewer);
  const isLoadingOlder = useConversation((state) => state.isLoadingOlder);
  const items = useConversation((state) => state.items);
  const lastPostId = useConversation((state) => state.lastPostId);
  const loadNewerPosts = useConversation((state) => state.loadNewerPosts);
  const loadOlderPosts = useConversation((state) => state.loadOlderPosts);
  const pendingHighlightPostId = useConversation(
    (state) => state.pendingHighlightPostId
  );
  const postIdToIndex = useConversation((state) => state.postIdToIndex);
  const scrollRequest = useConversation((state) => state.scrollRequest);
  const timelineSessionVersion = useConversation(
    (state) => state.timelineSessionVersion
  );
  const transcriptVariant = useConversation((state) => state.transcriptVariant);
  const markRead = useMutation(
    api.classes.forums.mutations.readState.markForumRead
  );
  const markReadPostId = useRef<Id<"schoolClassForumPosts"> | undefined>(
    undefined
  );
  const handleRef = useRef<VirtualizerHandle | null>(null);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const bottomBoundaryPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(
    null
  );
  const bottomPinRef = useRef<null | {
    attempts: number;
    requestId: number | null;
  }>(null);
  const pendingAnchorRef = useRef<Extract<
    ForumConversationView,
    { kind: "post" }
  > | null>(null);
  const previousLastPostIdRef = useRef(lastPostId);
  const previousTimelineSessionVersionRef = useRef<number | null>(null);
  const settleFrameIdRef = useRef<number | null>(null);
  const topBoundaryPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null
  );
  const [shiftBoundaryPostId, setShiftBoundaryPostId] =
    useState<Id<"schoolClassForumPosts"> | null>(null);
  const loadedPostBoundaries = useMemo(
    () => getLoadedPostBoundaries(items),
    [items]
  );
  const scheduleMarkRead = useDebouncedCallback(
    (nextPostId: Id<"schoolClassForumPosts">) => {
      if (markReadPostId.current === nextPostId) {
        return;
      }

      markRead({
        forumId,
        lastReadPostId: nextPostId,
      }).then(() => {
        markReadPostId.current = nextPostId;
      });
    },
    {
      delay: FORUM_MARK_READ_DELAY,
      flushOnUnmount: true,
    }
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

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const currentScrollElement = scrollElementRef.current;

    if (currentScrollElement) {
      currentScrollElement.scrollTo({
        behavior,
        top: currentScrollElement.scrollHeight,
      });
      return;
    }

    handleRef.current?.scrollTo(handleRef.current.scrollSize);
  }, []);

  const syncBottomState = useCallback(() => {
    const isNowAtBottom = getConversationBottomDistance(getMetrics()) <= 1;
    handleBottomStateChange(isNowAtBottom);
    return isNowAtBottom;
  }, [getMetrics, handleBottomStateChange]);

  const persistSettledView = useCallback(() => {
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
  }, [getMetrics, handleSettledView]);

  const syncHighlightVisibility = useCallback(() => {
    const currentScrollElement = scrollElementRef.current;

    if (!(pendingHighlightPostId && currentScrollElement)) {
      return;
    }

    if (
      !isConversationPostVisibleInDom({
        postId: pendingHighlightPostId,
        scrollElement: currentScrollElement,
      })
    ) {
      return;
    }

    handleHighlightVisiblePost(pendingHighlightPostId);
  }, [handleHighlightVisiblePost, pendingHighlightPostId]);

  const settleAnchor = useCallback(() => {
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

    if (status === "pending") {
      return true;
    }

    pendingAnchorRef.current = null;
    return false;
  }, []);

  const continueBottomPin = useCallback(() => {
    const pin = bottomPinRef.current;

    if (!pin) {
      return false;
    }

    const distance = getConversationBottomDistance(getMetrics());

    if (distance <= 1) {
      if (pin.requestId !== null) {
        clearScrollRequest(pin.requestId);
        pin.requestId = null;
      }
      pin.attempts = 0;
      return false;
    }

    if (pin.attempts >= FORUM_BOTTOM_PIN_RETRIES) {
      if (pin.requestId !== null) {
        clearScrollRequest(pin.requestId);
      }
      bottomPinRef.current = null;
      return false;
    }

    pin.attempts += 1;
    scrollToBottom("auto");
    return true;
  }, [clearScrollRequest, getMetrics, scrollToBottom]);

  const syncHistoryWindow = useCallback(() => {
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
    }

    if (
      isInTopZone &&
      hasMoreBefore &&
      loadedPostBoundaries.oldestPostId &&
      !isLoadingOlder &&
      topBoundaryPostIdRef.current !== loadedPostBoundaries.oldestPostId
    ) {
      topBoundaryPostIdRef.current = loadedPostBoundaries.oldestPostId;

      if (loadOlderPosts()) {
        setShiftBoundaryPostId(loadedPostBoundaries.oldestPostId);
      }
    }

    if (
      transcriptVariant === "focused" &&
      isInBottomZone &&
      hasMoreAfter &&
      loadedPostBoundaries.newestPostId &&
      !isLoadingNewer &&
      bottomBoundaryPostIdRef.current !== loadedPostBoundaries.newestPostId
    ) {
      bottomBoundaryPostIdRef.current = loadedPostBoundaries.newestPostId;
      loadNewerPosts();
    }
  }, [
    getMetrics,
    hasMoreAfter,
    hasMoreBefore,
    isLoadingNewer,
    isLoadingOlder,
    loadNewerPosts,
    loadOlderPosts,
    loadedPostBoundaries.newestPostId,
    loadedPostBoundaries.oldestPostId,
    transcriptVariant,
  ]);

  const settleTranscript = useCallback(() => {
    const isNowAtBottom = syncBottomState();

    syncHighlightVisibility();

    if (settleAnchor()) {
      return true;
    }

    if (continueBottomPin()) {
      return true;
    }

    syncHistoryWindow();
    persistSettledView();

    if (isNowAtBottom && isAtLatestEdge && lastPostId) {
      scheduleMarkRead(lastPostId);
      scheduleMarkRead.flush();
      return false;
    }

    scheduleMarkRead.cancel();
    return false;
  }, [
    continueBottomPin,
    isAtLatestEdge,
    lastPostId,
    persistSettledView,
    scheduleMarkRead,
    settleAnchor,
    syncBottomState,
    syncHighlightVisibility,
    syncHistoryWindow,
  ]);

  const scheduleSettleFrame = useCallback(() => {
    if (settleFrameIdRef.current !== null) {
      return;
    }

    const runSettleFrame = () => {
      settleFrameIdRef.current = null;
      const needsAnotherFrame = settleTranscript();

      if (!needsAnotherFrame) {
        return;
      }

      settleFrameIdRef.current = requestAnimationFrame(runSettleFrame);
    };

    settleFrameIdRef.current = requestAnimationFrame(runSettleFrame);
  }, [settleTranscript]);

  const handleScroll = useCallback(() => {
    const isNowAtBottom = syncBottomState();

    if (
      bottomPinRef.current &&
      !(transcriptVariant === "live" && isAtLatestEdge && isNowAtBottom)
    ) {
      bottomPinRef.current = null;
    }

    if (isNowAtBottom && isAtLatestEdge && lastPostId) {
      scheduleMarkRead(lastPostId);
    } else {
      scheduleMarkRead.cancel();
    }

    syncHighlightVisibility();
    syncHistoryWindow();
  }, [
    isAtLatestEdge,
    lastPostId,
    scheduleMarkRead,
    syncBottomState,
    syncHighlightVisibility,
    syncHistoryWindow,
    transcriptVariant,
  ]);

  useLayoutEffect(() => {
    const previousTimelineSessionVersion =
      previousTimelineSessionVersionRef.current;

    previousTimelineSessionVersionRef.current = timelineSessionVersion;

    if (
      previousTimelineSessionVersion === null ||
      previousTimelineSessionVersion === timelineSessionVersion
    ) {
      return;
    }

    bottomBoundaryPostIdRef.current = null;
    bottomPinRef.current = null;
    pendingAnchorRef.current = null;
    setShiftBoundaryPostId(null);
    topBoundaryPostIdRef.current = null;
  }, [timelineSessionVersion]);

  useLayoutEffect(() => {
    if (
      !(
        shiftBoundaryPostId &&
        loadedPostBoundaries.oldestPostId !== shiftBoundaryPostId
      )
    ) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      setShiftBoundaryPostId(null);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [loadedPostBoundaries.oldestPostId, shiftBoundaryPostId]);

  useLayoutEffect(() => {
    if (!(scrollElement && scrollRequest)) {
      return;
    }

    if (scrollRequest.kind === "latest") {
      if (transcriptVariant !== "live" || items.length === 0) {
        return;
      }

      bottomPinRef.current = {
        attempts: 0,
        requestId: scrollRequest.id,
      };
      scrollToBottom(scrollRequest.smooth ? "smooth" : "auto");
      scheduleSettleFrame();
      return;
    }

    const index =
      scrollRequest.kind === "jump"
        ? postIdToIndex.get(scrollRequest.postId)
        : postIdToIndex.get(scrollRequest.view.postId);

    if (index === undefined) {
      clearScrollRequest(scrollRequest.id);
      return;
    }

    if (scrollRequest.kind === "restore") {
      pendingAnchorRef.current = scrollRequest.view;
    } else {
      pendingAnchorRef.current = null;
    }

    handleRef.current?.scrollToIndex(index, {
      align: scrollRequest.kind === "jump" ? "center" : "start",
      smooth: scrollRequest.kind === "jump" && scrollRequest.smooth,
    });
    clearScrollRequest(scrollRequest.id);
    scheduleSettleFrame();
  }, [
    clearScrollRequest,
    items.length,
    postIdToIndex,
    scheduleSettleFrame,
    scrollElement,
    scrollRequest,
    scrollToBottom,
    transcriptVariant,
  ]);

  useLayoutEffect(() => {
    const previousLastPostId = previousLastPostIdRef.current;

    previousLastPostIdRef.current = lastPostId;

    if (
      !(
        lastPostId &&
        previousLastPostId &&
        lastPostId !== previousLastPostId &&
        isAtLatestEdge &&
        (isAtBottom || bottomPinRef.current)
      )
    ) {
      return;
    }

    scrollToBottom("auto");
    scheduleSettleFrame();
  }, [
    isAtBottom,
    isAtLatestEdge,
    lastPostId,
    scheduleSettleFrame,
    scrollToBottom,
  ]);

  useLayoutEffect(() => {
    if (!(scrollElement && typeof ResizeObserver !== "undefined")) {
      return;
    }

    const contentElement = scrollElement.firstElementChild;

    if (!(contentElement instanceof HTMLElement)) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!(bottomPinRef.current || pendingAnchorRef.current)) {
        return;
      }

      scheduleSettleFrame();
    });

    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [scheduleSettleFrame, scrollElement]);

  useLayoutEffect(
    () => () => {
      if (settleFrameIdRef.current !== null) {
        cancelAnimationFrame(settleFrameIdRef.current);
      }

      scheduleMarkRead.cancel();
      persistSettledView();
    },
    [persistSettledView, scheduleMarkRead]
  );

  return (
    <div
      className="absolute inset-0 overflow-y-auto overscroll-contain"
      data-testid="virtual-conversation"
      ref={setScrollElementRef}
      style={{ overflowAnchor: "none" }}
    >
      <Virtualizer
        bufferSize={FORUM_VIRTUAL_BUFFER_SIZE}
        data={items}
        onScroll={handleScroll}
        onScrollEnd={settleTranscript}
        ref={handleRef}
        scrollRef={scrollElementRef}
        shift={shiftBoundaryPostId !== null}
      >
        {(item) => (
          <TranscriptRow
            highlightedPostId={highlightedPostId}
            item={item}
            key={getConversationItemKey(item)}
          />
        )}
      </Virtualizer>
    </div>
  );
}

type ScrollBehavior = "auto" | "smooth";

/** Renders the local forum transcript placeholder while the first timeline is loading. */
export const ForumConversationTranscriptPlaceholder = memo(() => (
  <div
    className="flex min-h-0 flex-1 items-center justify-center"
    data-testid="virtual-conversation-placeholder"
  >
    <Spinner className="text-muted-foreground" />
  </div>
));
ForumConversationTranscriptPlaceholder.displayName =
  "ForumConversationTranscriptPlaceholder";

/** Renders one semantic transcript row inside one measured Virtua item. */
const TranscriptRow = memo(
  ({
    highlightedPostId,
    item,
  }: {
    highlightedPostId: Id<"schoolClassForumPosts"> | null;
    item: VirtualItem;
  }) => {
    if (item.type === "header") {
      return <ForumHeader forum={item.forum} />;
    }

    if (item.type === "date") {
      return <DateSeparator date={item.date} />;
    }

    if (item.type === "unread") {
      return <UnreadSeparator count={item.count} status={item.status} />;
    }

    return (
      <div
        className={cn(
          "flow-root w-full",
          item.isFirstInGroup && "pt-3",
          item.isLastInGroup && "pb-3"
        )}
        data-post-id={item.post._id}
      >
        <ForumPostItem
          isFirstInGroup={item.isFirstInGroup}
          isJumpHighlighted={highlightedPostId === item.post._id}
          post={item.post}
          showContinuationTime={item.showContinuationTime}
        />
      </div>
    );
  }
);
TranscriptRow.displayName = "TranscriptRow";
