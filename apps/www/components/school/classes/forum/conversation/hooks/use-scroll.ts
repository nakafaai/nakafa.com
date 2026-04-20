import { useDebouncedCallback, usePrevious } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  VirtualConversationAnchor,
  VirtualConversationHandle,
} from "@repo/design-system/types/virtual";
import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import {
  getForumPrefetchDistance,
  shouldRequestHistoryBoundary,
} from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import {
  getDistanceFromBottom,
  isAtTranscriptBottom,
  isNearReadStateBottom,
} from "@/components/school/classes/forum/conversation/utils/transcript-scroll";
import {
  createInitialConversationView,
  type ForumConversationMode,
} from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

const FORUM_SCROLL_SETTLE_DELAY = 80;

interface PendingOlderAnchor {
  offset: number;
  postId: Id<"schoolClassForumPosts">;
}

interface PendingInitialRestore {
  anchor: VirtualConversationAnchor;
  view: ForumConversationView;
}

interface ScrollToPostOptions {
  align?: "center" | "start";
  offset?: number;
  smooth?: boolean;
}

interface UseScrollResult {
  captureCurrentConversationView: () => ForumConversationView | null;
  containerRef: RefObject<HTMLDivElement | null>;
  handleInitialAnchorSettled: () => void;
  handleScroll: (offset: number) => void;
  initialAnchor: VirtualConversationAnchor | null;
  isAtBottom: boolean;
  isPostVisible: (postId: Id<"schoolClassForumPosts">) => boolean;
  markPendingBottomPersistence: () => void;
  resetPendingBottomPersistence: () => void;
  resetScrollState: () => void;
  scrollToBottom: (options?: { smooth?: boolean }) => boolean;
  scrollToPost: (
    postId: Id<"schoolClassForumPosts">,
    options?: ScrollToPostOptions
  ) => boolean;
}

/** Owns DOM-based forum transcript scrolling, anchoring, paging, and settle timing. */
export function useScroll({
  cancelPendingMarkRead,
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
  onHighlightVisiblePost,
  pendingLatestSessionRef,
  pendingHighlightPostIdRef,
  persistConversationView,
  postIdToIndex,
  scheduleMarkRead,
  scrollRef,
  timelineSessionVersion,
  unreadPostId,
}: {
  cancelPendingMarkRead: () => void;
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
  onHighlightVisiblePost?: (postId: Id<"schoolClassForumPosts">) => void;
  pendingHighlightPostIdRef: RefObject<Id<"schoolClassForumPosts"> | null>;
  pendingLatestSessionRef: RefObject<boolean>;
  persistConversationView: (view?: ForumConversationView | null) => void;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  scheduleMarkRead: (
    lastReadPostId: Id<"schoolClassForumPosts"> | undefined
  ) => void;
  scrollRef: RefObject<VirtualConversationHandle | null>;
  timelineSessionVersion: number;
  unreadPostId: Id<"schoolClassForumPosts"> | null;
}): UseScrollResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialSessionVersionRef = useRef<number | null>(null);
  const pendingBottomPersistenceRef = useRef(false);
  const pendingInitialRestoreRef = useRef<PendingInitialRestore | null>(null);
  const pendingOlderAnchorRef = useRef<PendingOlderAnchor | null>(null);
  const previousTimelineSessionVersionRef = useRef(timelineSessionVersion);
  const previousScrollOffsetRef = useRef(0);
  const lastRequestedNewerBoundaryRef =
    useRef<Id<"schoolClassForumPosts"> | null>(null);
  const lastRequestedOlderBoundaryRef =
    useRef<Id<"schoolClassForumPosts"> | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const previousLastPostId = usePrevious(lastPostId);
  const preferBottomInitialAnchor = pendingLatestSessionRef.current;
  const pendingInitialRestore = useMemo(() => {
    if (initialSessionVersionRef.current === timelineSessionVersion) {
      return null;
    }

    if (items.length === 0) {
      return null;
    }

    const view = createInitialConversationView({
      existingView: latestConversationView.current,
      mode: conversationIntent,
      preferBottom: preferBottomInitialAnchor,
      unreadPostId,
    });

    if (view.kind === "bottom") {
      return {
        anchor: { kind: "bottom" },
        view,
      } satisfies PendingInitialRestore;
    }

    const index = postIdToIndex.get(view.postId);

    if (index === undefined) {
      return null;
    }

    return {
      anchor: {
        align: conversationIntent.kind === "jump" ? "center" : "start",
        index,
        kind: "index",
        offset: view.offset,
      },
      view,
    } satisfies PendingInitialRestore;
  }, [
    conversationIntent,
    items.length,
    latestConversationView,
    postIdToIndex,
    preferBottomInitialAnchor,
    timelineSessionVersion,
    unreadPostId,
  ]);
  pendingInitialRestoreRef.current = pendingInitialRestore;

  /** Resets transient scroll refs whenever one transcript session changes. */
  const resetTimelineSessionState = useCallback(() => {
    initialSessionVersionRef.current = null;
    lastRequestedOlderBoundaryRef.current = null;
    lastRequestedNewerBoundaryRef.current = null;
    pendingOlderAnchorRef.current = null;
    previousScrollOffsetRef.current = 0;
    pendingBottomPersistenceRef.current = pendingLatestSessionRef.current;
  }, [pendingLatestSessionRef]);

  if (previousTimelineSessionVersionRef.current !== timelineSessionVersion) {
    previousTimelineSessionVersionRef.current = timelineSessionVersion;
    resetTimelineSessionState();
  }

  /** Scrolls the transcript to the latest bottom edge. */
  const scrollToBottom = useCallback(
    (options?: { smooth?: boolean }) => {
      const smooth = options?.smooth === true;
      const container = containerRef.current;

      if (!container) {
        return false;
      }

      const virtualHandle = scrollRef.current;

      if (virtualHandle?.scrollToBottom(smooth)) {
        return true;
      }

      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
      return true;
    },
    [scrollRef]
  );

  /** Scrolls the transcript so one post row lands at the desired alignment. */
  const scrollToPost = useCallback(
    (postId: Id<"schoolClassForumPosts">, options?: ScrollToPostOptions) => {
      if (!containerRef.current) {
        return false;
      }

      const index = postIdToIndex.get(postId);

      if (index === undefined) {
        return false;
      }

      return (
        scrollRef.current?.scrollToIndex(index, {
          align: options?.align,
          offset: options?.offset,
          smooth: options?.smooth,
        }) ?? false
      );
    },
    [postIdToIndex, scrollRef]
  );

  /** Finds the first visible post item at or after the current visible range start. */
  const getVisiblePostAnchor = useCallback(() => {
    const virtualHandle = scrollRef.current;

    if (!virtualHandle) {
      return null;
    }

    const scrollOffset = virtualHandle.getScrollOffset();
    const viewportBottom = scrollOffset + virtualHandle.getViewportSize();

    for (
      let index = virtualHandle.findItemIndex(scrollOffset);
      index < items.length;
      index += 1
    ) {
      const item = items[index];
      const itemStart = virtualHandle.getItemOffset(index);
      const itemEnd = itemStart + virtualHandle.getItemSize(index);

      if (itemStart >= viewportBottom) {
        return null;
      }

      if (!(item?.type === "post" && itemEnd > scrollOffset)) {
        continue;
      }

      return {
        offset: itemStart - scrollOffset,
        postId: item.post._id,
      };
    }

    return null;
  }, [items, scrollRef]);

  /** Captures the current transcript viewport into a persisted conversation view. */
  const captureCurrentConversationView = useCallback(() => {
    const container = containerRef.current;

    if (!container) {
      return null;
    }

    if (isAtTranscriptBottom(container)) {
      return { kind: "bottom" } satisfies ForumConversationView;
    }

    const anchor = getVisiblePostAnchor();

    if (!anchor) {
      return null;
    }

    return {
      kind: "post",
      offset: anchor.offset,
      postId: anchor.postId,
    } satisfies ForumConversationView;
  }, [getVisiblePostAnchor]);

  /** Returns whether one registered post row is currently visible. */
  const isPostVisible = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      const container = containerRef.current;
      const index = postIdToIndex.get(postId);
      const virtualHandle = scrollRef.current;

      if (!(container && virtualHandle && index !== undefined)) {
        return false;
      }

      const scrollOffset = virtualHandle.getScrollOffset();
      const viewportBottom = scrollOffset + virtualHandle.getViewportSize();
      const itemStart = virtualHandle.getItemOffset(index);
      const itemEnd = itemStart + virtualHandle.getItemSize(index);

      return itemStart < viewportBottom && itemEnd > scrollOffset;
    },
    [postIdToIndex, scrollRef]
  );

  /** Syncs the bottom flag only when its meaning actually changes. */
  const syncBottomState = useCallback((container: HTMLDivElement) => {
    const nextIsAtBottom = isAtTranscriptBottom(container);

    setIsAtBottom((currentIsAtBottom) =>
      currentIsAtBottom === nextIsAtBottom ? currentIsAtBottom : nextIsAtBottom
    );

    return nextIsAtBottom;
  }, []);

  /** Persists one latest-edge bottom view only after the viewport actually lands there. */
  const maybePersistBottomConversationView = useCallback(() => {
    const container = containerRef.current;

    if (
      !(
        container &&
        pendingBottomPersistenceRef.current &&
        initialSessionVersionRef.current === timelineSessionVersion &&
        isAtLatestEdge &&
        isAtTranscriptBottom(container)
      )
    ) {
      return false;
    }

    pendingBottomPersistenceRef.current = false;
    latestConversationView.current = { kind: "bottom" };
    persistConversationView({ kind: "bottom" });
    return true;
  }, [
    isAtLatestEdge,
    latestConversationView,
    persistConversationView,
    timelineSessionVersion,
  ]);

  /** Emits the pending highlight post once it is both mounted and visible. */
  const maybeHighlightVisiblePost = useCallback(() => {
    const postId = pendingHighlightPostIdRef.current;

    if (!(postId && isPostVisible(postId))) {
      return;
    }

    onHighlightVisiblePost?.(postId);
  }, [isPostVisible, onHighlightVisiblePost, pendingHighlightPostIdRef]);

  /** Saves the current semantic viewport once scrolling has visibly settled. */
  const handleScrollSettled = useDebouncedCallback(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const atBottom = syncBottomState(container);

    if (initialSessionVersionRef.current !== timelineSessionVersion) {
      return;
    }

    if (maybePersistBottomConversationView()) {
      maybeHighlightVisiblePost();
      return;
    }

    const currentView = captureCurrentConversationView();

    if (currentView) {
      latestConversationView.current = currentView;
    }

    persistConversationView(currentView);
    maybeHighlightVisiblePost();

    if (atBottom && isAtLatestEdge) {
      scheduleMarkRead(lastPostId);
      return;
    }

    cancelPendingMarkRead();
  }, FORUM_SCROLL_SETTLE_DELAY);

  /** Finalizes one fresh transcript session after its initial anchor settles. */
  const handleInitialAnchorSettled = useCallback(() => {
    if (initialSessionVersionRef.current === timelineSessionVersion) {
      return;
    }

    const pendingInitialRestore = pendingInitialRestoreRef.current;
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const nextView =
      pendingInitialRestore?.view ??
      captureCurrentConversationView() ??
      latestConversationView.current;

    initialSessionVersionRef.current = timelineSessionVersion;

    if (nextView) {
      latestConversationView.current = nextView;
      persistConversationView(nextView);
    }

    previousScrollOffsetRef.current = container.scrollTop;
    syncBottomState(container);

    if (isNearReadStateBottom(container) && isAtLatestEdge) {
      scheduleMarkRead(lastPostId);
    } else {
      cancelPendingMarkRead();
    }

    pendingLatestSessionRef.current = false;
    maybeHighlightVisiblePost();
  }, [
    cancelPendingMarkRead,
    captureCurrentConversationView,
    isAtLatestEdge,
    lastPostId,
    latestConversationView,
    maybeHighlightVisiblePost,
    pendingLatestSessionRef,
    persistConversationView,
    scheduleMarkRead,
    syncBottomState,
    timelineSessionVersion,
  ]);

  /** Requests one older page exactly once for the current oldest boundary. */
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

      const anchor = getVisiblePostAnchor();

      lastRequestedOlderBoundaryRef.current = boundaryPostId;
      pendingOlderAnchorRef.current = anchor;
      loadOlderPosts();
      return true;
    },
    [getVisiblePostAnchor, hasMoreBefore, isLoadingOlder, loadOlderPosts]
  );

  /** Requests one newer page exactly once for the current newest boundary. */
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

  /** Tracks scrolling, paging, back-history pruning, and read-state scheduling. */
  const handleScroll = useCallback(
    (offset: number) => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const atBottom = syncBottomState(container);

      const previousOffset = previousScrollOffsetRef.current;
      const prefetchDistance = getForumPrefetchDistance(container.clientHeight);
      const isMovingUp = offset < previousOffset;
      const isMovingDown = offset > previousOffset;
      const isNearTop = offset <= prefetchDistance;
      const isNearPrefetchBottom =
        getDistanceFromBottom(container) <= prefetchDistance;

      previousScrollOffsetRef.current = offset;

      if (isNearTop && isMovingUp) {
        requestOlderBoundary(oldestLoadedPostId);
      }

      if (isNearPrefetchBottom && isMovingDown) {
        requestNewerBoundary(newestLoadedPostId);
      }

      if (atBottom && isAtLatestEdge) {
        scheduleMarkRead(lastPostId);
      } else {
        cancelPendingMarkRead();
      }

      handleScrollSettled();
    },
    [
      cancelPendingMarkRead,
      handleScrollSettled,
      isAtLatestEdge,
      lastPostId,
      newestLoadedPostId,
      oldestLoadedPostId,
      requestNewerBoundary,
      requestOlderBoundary,
      scheduleMarkRead,
      syncBottomState,
    ]
  );

  /** Flushes read-state immediately when a new latest post arrives at the live bottom. */
  useLayoutEffect(() => {
    if (
      !(
        initialSessionVersionRef.current === timelineSessionVersion &&
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

    if (!isNearReadStateBottom(containerRef.current)) {
      return;
    }

    flushMarkRead(lastPostId);
  }, [
    flushMarkRead,
    isAtLatestEdge,
    lastPostId,
    previousLastPostId,
    timelineSessionVersion,
  ]);

  /** Keeps the same visible post anchored while older history prepends above it. */
  useLayoutEffect(() => {
    const pendingOlderAnchor = pendingOlderAnchorRef.current;

    if (!pendingOlderAnchor || isLoadingOlder) {
      return;
    }

    pendingOlderAnchorRef.current = null;
    const index = postIdToIndex.get(pendingOlderAnchor.postId);
    const virtualHandle = scrollRef.current;

    if (!(virtualHandle && index !== undefined)) {
      return;
    }

    virtualHandle.scrollToOffset(
      virtualHandle.getItemOffset(index) - pendingOlderAnchor.offset,
      false
    );
    previousScrollOffsetRef.current = virtualHandle.getScrollOffset();
  }, [isLoadingOlder, postIdToIndex, scrollRef]);

  /** Arms bottom persistence for the next explicit latest-edge landing. */
  const markPendingBottomPersistence = useCallback(() => {
    pendingBottomPersistenceRef.current = true;
  }, []);

  /** Clears any pending latest-edge persistence that no longer applies. */
  const resetPendingBottomPersistence = useCallback(() => {
    pendingBottomPersistenceRef.current = false;
  }, []);

  /** Resets local scroll state when the entire conversation unmounts. */
  const resetScrollState = useCallback(() => {
    initialSessionVersionRef.current = null;
    lastRequestedOlderBoundaryRef.current = null;
    lastRequestedNewerBoundaryRef.current = null;
    pendingOlderAnchorRef.current = null;
    previousScrollOffsetRef.current = 0;
    pendingBottomPersistenceRef.current = false;
  }, []);

  return {
    captureCurrentConversationView,
    containerRef,
    handleScroll,
    handleInitialAnchorSettled,
    initialAnchor: pendingInitialRestore?.anchor ?? null,
    isPostVisible,
    isAtBottom,
    markPendingBottomPersistence,
    resetPendingBottomPersistence,
    resetScrollState,
    scrollToBottom,
    scrollToPost,
  };
}
