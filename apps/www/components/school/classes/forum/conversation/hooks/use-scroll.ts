import { usePrevious } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualConversationHandle } from "@repo/design-system/types/virtual";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import type { PendingPostTarget } from "@/components/school/classes/forum/conversation/utils/post-target";
import {
  resolveScrollCommand,
  type ScrollCommand,
  shouldPersistBottomConversationView,
} from "@/components/school/classes/forum/conversation/utils/scroll-command";
import {
  getForumPrefetchDistance,
  shouldRequestHistoryBoundary,
} from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import {
  createInitialConversationView,
  type ForumConversationMode,
} from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

const FORUM_READ_STATE_NEAR_BOTTOM_THRESHOLD = 50;

interface UseScrollResult {
  clearScrollCommand: () => void;
  handleScroll: (offset: number) => void;
  handleScrollEnd: () => void;
  handleVirtualAnchorReady: () => void;
  isAtBottom: boolean;
  isConversationRevealed: boolean;
  isPrepending: boolean;
  markPendingBottomPersistence: () => void;
  resetPendingBottomPersistence: () => void;
  resetScrollState: () => void;
  scheduleScrollCommand: (command: ScrollCommand | null) => void;
}

interface PrependState {
  sessionVersion: number;
  startCount: number | null;
}

/** Returns whether the live transcript is close enough to bottom for read-state UX. */
function isNearReadStateBottom(
  handle: VirtualConversationHandle | null | undefined
) {
  if (!handle) {
    return false;
  }

  return (
    handle.isAtBottom() ||
    handle.getDistanceFromBottom() <= FORUM_READ_STATE_NEAR_BOTTOM_THRESHOLD
  );
}

/** Returns whether one older-page request still needs reverse-scroll shifting. */
function shouldKeepOlderPrependShift({
  isLoadingOlder,
  itemsLength,
  prependStartCount,
}: {
  isLoadingOlder: boolean;
  itemsLength: number;
  prependStartCount: number | null;
}) {
  return (
    prependStartCount !== null &&
    (isLoadingOlder || itemsLength > prependStartCount)
  );
}

/**
 * Owns the virtual-scroll lifecycle for one conversation session: scroll
 * commands, bottom persistence, anchor settle, edge paging, and read-state
 * timing.
 */
export function useScroll({
  cancelPendingMarkRead,
  captureCurrentConversationView,
  conversationIntent,
  flushMarkRead,
  hasMoreAfter,
  hasMoreBefore,
  isAtLatestEdge,
  isLoadingNewer,
  isLoadingOlder,
  items,
  lastPostId,
  latestConversationView,
  loadNewerPosts,
  loadOlderPosts,
  newestLoadedPostId,
  oldestLoadedPostId,
  pendingLatestSessionRef,
  pendingPostTargetRef,
  persistConversationView,
  postIdToIndex,
  pruneReachedBackHistory,
  scheduleMarkRead,
  scrollRef,
  settlePendingPostTarget,
  timelineSessionVersion,
  unreadIndex,
}: {
  cancelPendingMarkRead: () => void;
  captureCurrentConversationView: (
    offset?: number
  ) => ForumConversationView | null;
  conversationIntent: ForumConversationMode;
  flushMarkRead: (
    lastReadPostId: Id<"schoolClassForumPosts"> | undefined
  ) => void;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isAtLatestEdge: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  items: VirtualItem[];
  lastPostId: Id<"schoolClassForumPosts"> | undefined;
  latestConversationView: RefObject<ForumConversationView | null>;
  loadNewerPosts: () => void;
  loadOlderPosts: () => void;
  newestLoadedPostId: Id<"schoolClassForumPosts"> | null;
  oldestLoadedPostId: Id<"schoolClassForumPosts"> | null;
  pendingLatestSessionRef: RefObject<boolean>;
  pendingPostTargetRef: RefObject<PendingPostTarget | null>;
  persistConversationView: (view?: ForumConversationView | null) => void;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  pruneReachedBackHistory: (currentView: ForumConversationView | null) => void;
  scheduleMarkRead: (
    lastReadPostId: Id<"schoolClassForumPosts"> | undefined
  ) => void;
  scrollRef: RefObject<VirtualConversationHandle | null>;
  settlePendingPostTarget: () => boolean;
  timelineSessionVersion: number;
  unreadIndex: number | null;
}): UseScrollResult {
  const initialAnchorSettledRef = useRef(false);
  const persistBottomOnArrivalRef = useRef(false);
  const previousTimelineSessionVersionRef = useRef(timelineSessionVersion);
  const lastRequestedNewerBoundaryRef =
    useRef<Id<"schoolClassForumPosts"> | null>(null);
  const lastRequestedOlderBoundaryRef =
    useRef<Id<"schoolClassForumPosts"> | null>(null);
  const previousScrollOffsetRef = useRef(0);

  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isConversationRevealed, setIsConversationRevealed] = useState(false);
  const [prependState, setPrependState] = useState<PrependState>(() => ({
    sessionVersion: timelineSessionVersion,
    startCount: null,
  }));
  const [scrollCommand, setScrollCommand] = useState<ScrollCommand | null>(
    null
  );
  const previousLastPostId = usePrevious(lastPostId);
  const prependStartCount =
    prependState.sessionVersion === timelineSessionVersion
      ? prependState.startCount
      : null;

  const hasPrependedOlderItems =
    prependStartCount !== null && items.length > prependStartCount;
  const isPrepending = shouldKeepOlderPrependShift({
    isLoadingOlder,
    itemsLength: items.length,
    prependStartCount,
  });

  /** Resets transient scroll refs whenever one semantic transcript session remounts. */
  const resetTimelineSessionState = useCallback(() => {
    initialAnchorSettledRef.current = false;
    persistBottomOnArrivalRef.current = pendingLatestSessionRef.current;
    previousScrollOffsetRef.current = 0;
    lastRequestedOlderBoundaryRef.current = null;
    lastRequestedNewerBoundaryRef.current = null;
  }, [pendingLatestSessionRef]);

  if (previousTimelineSessionVersionRef.current !== timelineSessionVersion) {
    previousTimelineSessionVersionRef.current = timelineSessionVersion;
    resetTimelineSessionState();
  }

  /** Commits the exact latest-edge landing into the persisted semantic view store. */
  const persistBottomConversationView = useCallback(() => {
    const bottomView = { kind: "bottom" } satisfies ForumConversationView;

    persistBottomOnArrivalRef.current = false;
    latestConversationView.current = bottomView;
    persistConversationView(bottomView);
  }, [latestConversationView, persistConversationView]);

  /** Persists a latest-edge command only after the viewport actually lands at bottom. */
  const maybePersistBottomConversationView = useCallback(
    (atBottom: boolean) => {
      if (
        !shouldPersistBottomConversationView({
          hasPendingBottomPersistence: persistBottomOnArrivalRef.current,
          isAtBottom: atBottom,
          isAtLatestEdge,
          isInitialAnchorSettled: initialAnchorSettledRef.current,
        })
      ) {
        return false;
      }

      persistBottomConversationView();
      return true;
    },
    [isAtLatestEdge, persistBottomConversationView]
  );

  /** Requests one older page for the current oldest loaded boundary exactly once. */
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
        return false;
      }

      lastRequestedOlderBoundaryRef.current = boundaryPostId;
      setPrependState({
        sessionVersion: timelineSessionVersion,
        startCount: items.length,
      });
      loadOlderPosts();
      return true;
    },
    [
      hasMoreBefore,
      isLoadingOlder,
      items.length,
      loadOlderPosts,
      timelineSessionVersion,
    ]
  );

  /** Requests one newer page for the current newest loaded boundary exactly once. */
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
        return false;
      }

      lastRequestedNewerBoundaryRef.current = boundaryPostId;
      loadNewerPosts();
      return true;
    },
    [hasMoreAfter, isLoadingNewer, loadNewerPosts]
  );

  /** Syncs the controller's bottom flag only when its meaning actually changes. */
  const syncBottomState = useCallback((nextIsAtBottom: boolean) => {
    setIsAtBottom((currentIsAtBottom) =>
      currentIsAtBottom === nextIsAtBottom ? currentIsAtBottom : nextIsAtBottom
    );
  }, []);

  /** Finalizes one anchor-ready conversation session after any pending jump lands. */
  const finalizeConversationReady = useCallback(() => {
    if (initialAnchorSettledRef.current) {
      return;
    }

    initialAnchorSettledRef.current = true;

    const initialView =
      captureCurrentConversationView() ??
      createInitialConversationView({
        existingView: latestConversationView.current,
        items,
        mode: conversationIntent,
        unreadIndex,
      });

    if (initialView) {
      latestConversationView.current = initialView;
      persistConversationView(initialView);
    }

    const isNearBottom = scrollRef.current
      ? isNearReadStateBottom(scrollRef.current)
      : initialView?.kind === "bottom";
    const atBottom =
      scrollRef.current?.isAtBottom() ?? initialView?.kind === "bottom";

    previousScrollOffsetRef.current = scrollRef.current?.getScrollOffset() ?? 0;
    syncBottomState(atBottom);
    setIsConversationRevealed(true);

    if (!(isNearBottom && isAtLatestEdge)) {
      pendingLatestSessionRef.current = false;
      cancelPendingMarkRead();
      return;
    }

    pendingLatestSessionRef.current = false;
    scheduleMarkRead(lastPostId);
  }, [
    cancelPendingMarkRead,
    captureCurrentConversationView,
    conversationIntent,
    isAtLatestEdge,
    items,
    lastPostId,
    latestConversationView,
    pendingLatestSessionRef,
    persistConversationView,
    scheduleMarkRead,
    scrollRef,
    syncBottomState,
    unreadIndex,
  ]);

  /** Runs one resolved in-session scroll command as soon as the target is rendered. */
  useLayoutEffect(() => {
    const resolvedScrollCommand = resolveScrollCommand({
      command: scrollCommand,
      postIdToIndex,
    });

    if (!resolvedScrollCommand) {
      return;
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollToIndex(resolvedScrollCommand.index, {
        align: resolvedScrollCommand.align,
        offset: resolvedScrollCommand.offset,
      });
    });
    setScrollCommand(null);
  }, [postIdToIndex, scrollCommand, scrollRef]);

  /** Tracks scroll progress, read-state scheduling, semantic view updates, and paging. */
  const handleScroll = useCallback(
    (offset: number) => {
      const handle = scrollRef.current;
      const atBottom = handle?.isAtBottom() ?? false;

      syncBottomState(atBottom);

      if (pendingPostTargetRef.current) {
        previousScrollOffsetRef.current = offset;
        return;
      }

      let currentView: ForumConversationView | null = null;

      if (initialAnchorSettledRef.current) {
        currentView = captureCurrentConversationView(offset);
        pruneReachedBackHistory(currentView);
      }

      const isNearBottom = isNearReadStateBottom(handle);

      maybePersistBottomConversationView(atBottom);

      if (!(initialAnchorSettledRef.current && handle)) {
        previousScrollOffsetRef.current = offset;
        return;
      }

      const previousOffset = previousScrollOffsetRef.current;
      const viewportSize = handle.getViewportSize();
      const prefetchDistance = getForumPrefetchDistance(viewportSize);
      const isMovingUp = offset < previousOffset;
      const isMovingDown = offset > previousOffset;
      const isNearTop = offset <= prefetchDistance;
      const isNearPrefetchBottom =
        handle.getDistanceFromBottom() <= prefetchDistance;

      previousScrollOffsetRef.current = offset;

      if (isNearTop && isMovingUp) {
        requestOlderBoundary(oldestLoadedPostId);
      }

      if (isNearPrefetchBottom && isMovingDown) {
        requestNewerBoundary(newestLoadedPostId);
      }

      if (!(isNearBottom && isAtLatestEdge)) {
        cancelPendingMarkRead();
        return;
      }

      scheduleMarkRead(lastPostId);
    },
    [
      cancelPendingMarkRead,
      captureCurrentConversationView,
      isAtLatestEdge,
      lastPostId,
      maybePersistBottomConversationView,
      newestLoadedPostId,
      oldestLoadedPostId,
      pendingPostTargetRef,
      pruneReachedBackHistory,
      requestNewerBoundary,
      requestOlderBoundary,
      scheduleMarkRead,
      scrollRef,
      syncBottomState,
    ]
  );

  /** Waits for any pending jump target before the conversation can settle. */
  const handleVirtualAnchorReady = useCallback(() => {
    if (!settlePendingPostTarget()) {
      return;
    }

    finalizeConversationReady();
  }, [finalizeConversationReady, settlePendingPostTarget]);

  /** Saves the latest fallback snapshot when scrolling settles between gestures. */
  const handleScrollEnd = useCallback(() => {
    const atBottom = scrollRef.current?.isAtBottom() ?? false;

    syncBottomState(atBottom);

    if (!settlePendingPostTarget()) {
      return;
    }

    if (!initialAnchorSettledRef.current) {
      finalizeConversationReady();
      return;
    }

    if (maybePersistBottomConversationView(atBottom)) {
      return;
    }

    const currentView = captureCurrentConversationView();

    pruneReachedBackHistory(currentView);
    persistConversationView(currentView);
  }, [
    captureCurrentConversationView,
    finalizeConversationReady,
    maybePersistBottomConversationView,
    persistConversationView,
    pruneReachedBackHistory,
    scrollRef,
    settlePendingPostTarget,
    syncBottomState,
  ]);

  /** Flushes read-state immediately when a new latest post arrives at the live bottom. */
  useEffect(() => {
    if (
      !(
        initialAnchorSettledRef.current &&
        isAtLatestEdge &&
        lastPostId &&
        previousLastPostId
      )
    ) {
      return;
    }

    if (lastPostId === previousLastPostId) {
      return;
    }

    if (!isNearReadStateBottom(scrollRef.current)) {
      return;
    }

    flushMarkRead(lastPostId);
  }, [
    flushMarkRead,
    isAtLatestEdge,
    lastPostId,
    previousLastPostId,
    scrollRef,
  ]);

  /** Drops reverse-scroll shift once the prepended page has fully landed. */
  useEffect(() => {
    if (
      !(prependStartCount !== null && !isLoadingOlder && hasPrependedOlderItems)
    ) {
      return;
    }

    setPrependState({
      sessionVersion: timelineSessionVersion,
      startCount: null,
    });
  }, [
    hasPrependedOlderItems,
    isLoadingOlder,
    prependStartCount,
    timelineSessionVersion,
  ]);

  /** Marks the next latest-edge command so bottom persistence can land naturally. */
  const markPendingBottomPersistence = useCallback(() => {
    persistBottomOnArrivalRef.current = true;
  }, []);

  /** Clears any pending latest-edge persistence that no longer applies. */
  const resetPendingBottomPersistence = useCallback(() => {
    persistBottomOnArrivalRef.current = false;
  }, []);

  /** Queues one in-session scroll command for the virtual list to execute later. */
  const scheduleScrollCommand = useCallback((command: ScrollCommand | null) => {
    setScrollCommand(command);
  }, []);

  /** Clears any queued in-session scroll command that is no longer relevant. */
  const clearScrollCommand = useCallback(() => {
    setScrollCommand(null);
  }, []);

  /** Resets transient scroll refs when the entire conversation session is discarded. */
  const resetScrollState = useCallback(() => {
    initialAnchorSettledRef.current = false;
    persistBottomOnArrivalRef.current = false;
    previousScrollOffsetRef.current = 0;
    lastRequestedOlderBoundaryRef.current = null;
    lastRequestedNewerBoundaryRef.current = null;
    setPrependState({
      sessionVersion: timelineSessionVersion,
      startCount: null,
    });
    setScrollCommand(null);
  }, [timelineSessionVersion]);

  return {
    clearScrollCommand,
    handleScroll,
    handleScrollEnd,
    handleVirtualAnchorReady,
    isAtBottom,
    isConversationRevealed,
    isPrepending,
    markPendingBottomPersistence,
    resetPendingBottomPersistence,
    resetScrollState,
    scheduleScrollCommand,
  };
}
