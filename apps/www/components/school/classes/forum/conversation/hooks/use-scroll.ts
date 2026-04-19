import { useDebouncedCallback, usePrevious } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualConversationHandle } from "@repo/design-system/types/virtual";
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
  clampScrollTop,
  findVisiblePostAnchor,
  getDistanceFromBottom,
  getScrollTopForPost,
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
  itemCount: number;
  postId: Id<"schoolClassForumPosts">;
  top: number;
}

interface ScrollToPostOptions {
  align?: "center" | "start";
  offset?: number;
  smooth?: boolean;
}

interface UseScrollResult {
  captureCurrentConversationView: () => ForumConversationView | null;
  containerRef: RefObject<HTMLDivElement | null>;
  handleScroll: (offset: number) => void;
  isAtBottom: boolean;
  isConversationRevealed: boolean;
  markPendingBottomPersistence: () => void;
  registerPostElement: (
    postId: Id<"schoolClassForumPosts">,
    element: HTMLDivElement | null
  ) => void;
  resetPendingBottomPersistence: () => void;
  resetScrollState: () => void;
  scrollToBottom: (options?: { smooth?: boolean }) => boolean;
  scrollToPost: (
    postId: Id<"schoolClassForumPosts">,
    options?: ScrollToPostOptions
  ) => boolean;
}

/** Owns DOM-based forum transcript scrolling, anchoring, paging, and reveal timing. */
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
  onNavigationSettled,
  pendingLatestSessionRef,
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
  onNavigationSettled?: () => void;
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
  const postElementsRef = useRef(
    new Map<Id<"schoolClassForumPosts">, HTMLDivElement>()
  );
  const initialSessionVersionRef = useRef<number | null>(null);
  const pendingBottomPersistenceRef = useRef(false);
  const pendingOlderAnchorRef = useRef<PendingOlderAnchor | null>(null);
  const previousTimelineSessionVersionRef = useRef(timelineSessionVersion);
  const previousScrollOffsetRef = useRef(0);
  const lastRequestedNewerBoundaryRef =
    useRef<Id<"schoolClassForumPosts"> | null>(null);
  const lastRequestedOlderBoundaryRef =
    useRef<Id<"schoolClassForumPosts"> | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [revealedSessionVersion, setRevealedSessionVersion] = useState<
    number | null
  >(null);
  const previousLastPostId = usePrevious(lastPostId);
  const isConversationRevealed =
    revealedSessionVersion === timelineSessionVersion;
  const orderedPostIds = useMemo(
    () =>
      items.flatMap((item) =>
        item.type === "post" ? ([item.post._id] as const) : []
      ),
    [items]
  );

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

  /** Stores or clears the DOM node for one rendered forum post row. */
  const registerPostElement = useCallback(
    (postId: Id<"schoolClassForumPosts">, element: HTMLDivElement | null) => {
      if (!element) {
        postElementsRef.current.delete(postId);
        return;
      }

      postElementsRef.current.set(postId, element);
    },
    []
  );

  /** Scrolls the transcript container to one absolute scrollTop. */
  const scrollContainerTo = useCallback(
    (container: HTMLDivElement, scrollTop: number, smooth: boolean) => {
      container.scrollTo({
        top: clampScrollTop(container, scrollTop),
        behavior: smooth ? "smooth" : "auto",
      });
      return true;
    },
    []
  );

  /** Scrolls the transcript to the latest bottom edge. */
  const scrollToBottom = useCallback(
    (options?: { smooth?: boolean }) => {
      const container = containerRef.current;

      if (!container) {
        return false;
      }

      return scrollContainerTo(
        container,
        container.scrollHeight,
        options?.smooth ?? false
      );
    },
    [scrollContainerTo]
  );

  /** Scrolls the transcript so one post row lands at the desired alignment. */
  const scrollToPost = useCallback(
    (postId: Id<"schoolClassForumPosts">, options?: ScrollToPostOptions) => {
      const container = containerRef.current;
      const element = postElementsRef.current.get(postId);

      if (!(container && element)) {
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
      }

      const align = options?.align ?? "start";
      const offset = options?.offset ?? 0;
      const scrollTop = getScrollTopForPost({
        align,
        container,
        element,
        offset,
      });

      return scrollContainerTo(container, scrollTop, options?.smooth ?? false);
    },
    [postIdToIndex, scrollContainerTo, scrollRef]
  );

  /** Captures the current transcript viewport into a persisted conversation view. */
  const captureCurrentConversationView = useCallback(() => {
    const container = containerRef.current;

    if (!container) {
      return null;
    }

    if (isAtTranscriptBottom(container)) {
      return { kind: "bottom" } satisfies ForumConversationView;
    }

    const anchor = findVisiblePostAnchor({
      container,
      orderedPostIds,
      postElements: postElementsRef.current,
    });

    if (!anchor) {
      return null;
    }

    return {
      kind: "post",
      offset: anchor.top,
      postId: anchor.postId,
    } satisfies ForumConversationView;
  }, [orderedPostIds]);

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
      onNavigationSettled?.();
      return;
    }

    const currentView = captureCurrentConversationView();

    if (currentView) {
      latestConversationView.current = currentView;
    }

    persistConversationView(currentView);
    onNavigationSettled?.();

    if (atBottom && isAtLatestEdge) {
      scheduleMarkRead(lastPostId);
      return;
    }

    cancelPendingMarkRead();
  }, FORUM_SCROLL_SETTLE_DELAY);

  /** Requests one older page exactly once for the current oldest boundary. */
  const requestOlderBoundary = useCallback(
    ({
      boundaryPostId,
      container,
    }: {
      boundaryPostId: Id<"schoolClassForumPosts"> | null;
      container: HTMLDivElement;
    }) => {
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

      const anchor = findVisiblePostAnchor({
        container,
        orderedPostIds,
        postElements: postElementsRef.current,
      });

      lastRequestedOlderBoundaryRef.current = boundaryPostId;
      pendingOlderAnchorRef.current = anchor
        ? {
            itemCount: orderedPostIds.length,
            postId: anchor.postId,
            top: anchor.top,
          }
        : null;
      loadOlderPosts();
      return true;
    },
    [hasMoreBefore, isLoadingOlder, loadOlderPosts, orderedPostIds]
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
        requestOlderBoundary({ boundaryPostId: oldestLoadedPostId, container });
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

  /** Finalizes one fresh transcript session once rows and the container are mounted. */
  useLayoutEffect(() => {
    if (initialSessionVersionRef.current === timelineSessionVersion) {
      return;
    }

    const container = containerRef.current;

    if (!(container && items.length > 0)) {
      return;
    }

    const initialView = createInitialConversationView({
      existingView: latestConversationView.current,
      mode: conversationIntent,
      preferBottom: pendingLatestSessionRef.current,
      unreadPostId,
    });
    const didRestore =
      initialView.kind === "bottom"
        ? scrollToBottom({ smooth: false })
        : scrollToPost(initialView.postId, {
            align: conversationIntent.kind === "jump" ? "center" : "start",
            offset: initialView.offset,
            smooth: false,
          });

    if (!didRestore) {
      return;
    }

    initialSessionVersionRef.current = timelineSessionVersion;
    latestConversationView.current = initialView;
    persistConversationView(initialView);
    previousScrollOffsetRef.current = container.scrollTop;
    syncBottomState(container);
    setRevealedSessionVersion(timelineSessionVersion);

    if (isNearReadStateBottom(container) && isAtLatestEdge) {
      scheduleMarkRead(lastPostId);
    } else {
      cancelPendingMarkRead();
    }

    pendingLatestSessionRef.current = false;
    onNavigationSettled?.();
  }, [
    cancelPendingMarkRead,
    conversationIntent,
    isAtLatestEdge,
    items.length,
    lastPostId,
    latestConversationView,
    onNavigationSettled,
    pendingLatestSessionRef,
    persistConversationView,
    scheduleMarkRead,
    scrollToBottom,
    scrollToPost,
    syncBottomState,
    timelineSessionVersion,
    unreadPostId,
  ]);

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

    if (orderedPostIds.length <= pendingOlderAnchor.itemCount) {
      return;
    }

    const container = containerRef.current;
    const element = postElementsRef.current.get(pendingOlderAnchor.postId);

    if (!(container && element)) {
      return;
    }

    const nextTop =
      element.getBoundingClientRect().top -
      container.getBoundingClientRect().top;
    container.scrollTop += nextTop - pendingOlderAnchor.top;
    previousScrollOffsetRef.current = container.scrollTop;
  }, [isLoadingOlder, orderedPostIds.length]);

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
    setRevealedSessionVersion(null);
  }, []);

  return {
    captureCurrentConversationView,
    containerRef,
    handleScroll,
    isAtBottom,
    isConversationRevealed,
    markPendingBottomPersistence,
    registerPostElement,
    resetPendingBottomPersistence,
    resetScrollState,
    scrollToBottom,
    scrollToPost,
  };
}
