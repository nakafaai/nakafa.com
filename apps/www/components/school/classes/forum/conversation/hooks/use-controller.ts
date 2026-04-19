import { useReducedMotion, useTimeout } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  VirtualConversationAnchor,
  VirtualConversationHandle,
} from "@repo/design-system/types/virtual";
import { useConvex } from "convex/react";
import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHistory } from "@/components/school/classes/forum/conversation/hooks/use-history";
import { useItems } from "@/components/school/classes/forum/conversation/hooks/use-items";
import { usePosts } from "@/components/school/classes/forum/conversation/hooks/use-posts";
import { useRead } from "@/components/school/classes/forum/conversation/hooks/use-read";
import { useScroll } from "@/components/school/classes/forum/conversation/hooks/use-scroll";
import { useUnread } from "@/components/school/classes/forum/conversation/hooks/use-unread";
import { useView } from "@/components/school/classes/forum/conversation/hooks/use-view";
import type {
  Forum,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import {
  createFocusedTimelineState,
  createFocusedWindowArgs,
} from "@/components/school/classes/forum/conversation/utils/focused";
import { goToLatestEdge } from "@/components/school/classes/forum/conversation/utils/latest";
import { isForumPostVisible } from "@/components/school/classes/forum/conversation/utils/post-target";
import {
  captureConversationView,
  createForumConversationMode,
  type ForumConversationMode,
} from "@/components/school/classes/forum/conversation/utils/view";
import { useForum, useForumStoreApi } from "@/lib/context/use-forum";
import type { ForumConversationView } from "@/lib/store/forum";

const FORUM_JUMP_HIGHLIGHT_DURATION = 1600;

interface ForumScrollValue {
  jumpToPostId: (postId: Id<"schoolClassForumPosts">) => void;
  scrollToLatest: () => void;
}

interface UseControllerResult {
  acknowledgeUnreadCue: () => void;
  canGoBack: boolean;
  forumScrollValue: ForumScrollValue;
  goBack: () => void;
  handleScroll: (offset: number) => void;
  handleScrollEnd: () => void;
  handleVirtualAnchorReady: () => void;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  initialAnchor: VirtualConversationAnchor;
  isAtBottom: boolean;
  isAtLatestEdge: boolean;
  isConversationRevealed: boolean;
  isInitialLoading: boolean;
  isPrepending: boolean;
  items: VirtualItem[];
  scrollRef: RefObject<VirtualConversationHandle | null>;
  scrollToLatest: () => void;
  timelineSessionVersion: number;
}

/** Owns the forum conversation state machine and exposes a thin render-facing API. */
export function useController({
  forum,
  forumId,
}: {
  forum: Forum | undefined;
  forumId: Id<"schoolClassForums">;
}): UseControllerResult {
  const convex = useConvex();
  const prefersReducedMotion = useReducedMotion();
  const forumStore = useForumStoreApi();
  const saveConversationView = useForum((state) => state.saveConversationView);
  const savedConversationView =
    forumStore.getState().savedConversationViews[forumId] ?? null;
  const [conversationIntent, setConversationIntent] =
    useState<ForumConversationMode>(() =>
      createForumConversationMode({
        restoreView: savedConversationView,
      })
    );
  const jumpRequestIdRef = useRef(0);
  const pendingJumpHighlightPostIdRef =
    useRef<Id<"schoolClassForumPosts"> | null>(null);
  const pendingLatestSessionRef = useRef(false);
  const scrollRef = useRef<VirtualConversationHandle>(null);
  const [highlightedPostId, setHighlightedPostId] =
    useState<Id<"schoolClassForumPosts"> | null>(null);
  const {
    hasMoreAfter,
    hasMoreBefore,
    isAtLatestEdge,
    isInitialLoading,
    isLoadingNewer,
    isLoadingOlder,
    loadNewerPosts,
    loadOlderPosts,
    posts,
    replaceWithFocusedTimeline,
    showLatestPosts,
    timelineSessionVersion,
  } = usePosts({ forumId, mode: conversationIntent });
  const baselineLatestPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(
    null
  );

  if (
    baselineLatestPostIdRef.current === null &&
    isAtLatestEdge &&
    posts.length > 0
  ) {
    baselineLatestPostIdRef.current = posts.at(-1)?._id ?? null;
  }

  const { acknowledgeUnreadCue, unreadCue } = useUnread({
    baselineLatestPostId: baselineLatestPostIdRef.current,
    isDetachedMode: !isAtLatestEdge,
    isInitialLoading,
    posts,
  });
  const { dateToIndex, headerIndex, items, postIdToIndex, unreadIndex } =
    useItems({
      forum,
      isDetachedMode: !isAtLatestEdge,
      posts,
      unreadCue,
    });
  const latestItemsRef = useRef(items);
  latestItemsRef.current = items;
  const oldestLoadedPostId = posts[0]?._id ?? null;
  const lastPostId = posts.at(-1)?._id;
  const newestLoadedPostId = lastPostId ?? null;
  const {
    captureCurrentConversationView,
    initialAnchor,
    latestConversationView,
    persistConversationView,
    restoreConversationViewLocally,
  } = useView({
    conversationIntent,
    dateToIndex,
    forumId,
    headerIndex,
    items,
    postIdToIndex,
    preferBottom: pendingLatestSessionRef.current,
    saveConversationView,
    savedConversationView,
    scrollRef,
    unreadIndex,
  });
  const {
    canGoBack,
    clearJumpHistory,
    pruneReachedBackHistory,
    pushCurrentViewToBackStack,
    takeBackView,
  } = useHistory({
    captureCurrentConversationView,
    dateToIndex,
    headerIndex,
    latestConversationView,
    postIdToIndex,
    unreadIndex,
  });
  const { cancelPendingMarkRead, flushMarkRead, scheduleMarkRead } = useRead({
    forumId,
  });
  const shouldAnimateNavigation = !prefersReducedMotion;
  const { clear: clearJumpHighlightTimeout, start: startJumpHighlightTimeout } =
    useTimeout(() => {
      setHighlightedPostId(null);
    }, FORUM_JUMP_HIGHLIGHT_DURATION);

  /** Clears any transient jump highlight that should not survive navigation changes. */
  const clearJumpHighlight = useCallback(() => {
    pendingJumpHighlightPostIdRef.current = null;
    clearJumpHighlightTimeout();
    setHighlightedPostId(null);
  }, [clearJumpHighlightTimeout]);

  /** Queues one post to highlight after the explicit jump visibly lands. */
  const queueJumpHighlight = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      clearJumpHighlightTimeout();
      pendingJumpHighlightPostIdRef.current = postId;
      setHighlightedPostId(null);
    },
    [clearJumpHighlightTimeout]
  );

  /** Activates the queued jump highlight only once the target row is actually visible. */
  const maybeActivateJumpHighlight = useCallback(() => {
    const postId = pendingJumpHighlightPostIdRef.current;
    const handle = scrollRef.current;

    if (!(postId && handle)) {
      return;
    }

    const index = postIdToIndex.get(postId);

    if (index === undefined) {
      return;
    }

    if (!isForumPostVisible({ handle, index })) {
      return;
    }

    pendingJumpHighlightPostIdRef.current = null;
    clearJumpHighlightTimeout();
    setHighlightedPostId(postId);
    startJumpHighlightTimeout();
  }, [clearJumpHighlightTimeout, postIdToIndex, startJumpHighlightTimeout]);

  const {
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
  } = useScroll({
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
    onNavigationSettled: maybeActivateJumpHighlight,
    pendingLatestSessionRef,
    persistConversationView,
    postIdToIndex,
    pruneReachedBackHistory,
    scheduleMarkRead,
    scrollRef,
    timelineSessionVersion,
    unreadIndex,
  });

  /** Invalidates any stale unloaded jump request before a new intent takes over. */
  const cancelPendingJumpRequest = useCallback(() => {
    jumpRequestIdRef.current += 1;
  }, []);

  /** Starts one unloaded jump request and returns the token used to accept its result. */
  const beginPendingJumpRequest = useCallback(() => {
    const nextJumpRequestId = jumpRequestIdRef.current + 1;

    jumpRequestIdRef.current = nextJumpRequestId;
    return nextJumpRequestId;
  }, []);

  /** Clears transient jump flow state before another navigation intent takes over. */
  const resetDetachedFlow = useCallback(() => {
    cancelPendingJumpRequest();
    clearJumpHighlight();
    pendingLatestSessionRef.current = false;
    resetPendingBottomPersistence();
    clearScrollCommand();
  }, [
    cancelPendingJumpRequest,
    clearJumpHighlight,
    clearScrollCommand,
    resetPendingBottomPersistence,
  ]);

  /** Loads one focused around-post timeline and swaps the transcript when it resolves. */
  const requestFocusedTimeline = useCallback(
    async ({
      onRejected,
      postId,
      targetKind,
      nextIntent,
    }: {
      onRejected: () => void;
      postId: Id<"schoolClassForumPosts">;
      targetKind: "jump" | "restore";
      nextIntent: ForumConversationMode;
    }) => {
      const requestId = beginPendingJumpRequest();

      setConversationIntent(nextIntent);
      try {
        const aroundResult = await convex.query(
          api.classes.forums.queries.around.getForumPostsAround,
          createFocusedWindowArgs({
            forumId,
            targetPostId: postId,
          })
        );

        if (jumpRequestIdRef.current !== requestId) {
          return;
        }

        replaceWithFocusedTimeline(
          createFocusedTimelineState({
            aroundResult,
            targetKind,
          })
        );
      } catch {
        if (jumpRequestIdRef.current !== requestId) {
          return;
        }

        onRejected();
      }
    },
    [beginPendingJumpRequest, convex, forumId, replaceWithFocusedTimeline]
  );

  /** Returns the conversation to the live latest edge. */
  const showLatestEdge = useCallback(() => {
    goToLatestEdge({
      cancelPendingJumpRequest,
      clearScrollCommand,
      isAtLatestEdge,
      markPendingBottomPersistence,
      pendingLatestSessionRef,
      scrollRef,
      showLatestPosts,
      smooth: shouldAnimateNavigation,
      showLiveConversation: () => {
        setConversationIntent({ kind: "live" });
      },
    });
  }, [
    cancelPendingJumpRequest,
    clearScrollCommand,
    isAtLatestEdge,
    markPendingBottomPersistence,
    shouldAnimateNavigation,
    showLatestPosts,
  ]);

  /** Opens a post directly or switches the conversation into jump mode. */
  const jumpToPostId = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      const index = postIdToIndex.get(postId);
      const nextView = {
        kind: "post",
        offset: 0,
        postId,
      } satisfies ForumConversationView;

      pushCurrentViewToBackStack();
      latestConversationView.current = nextView;
      persistConversationView(nextView);
      resetDetachedFlow();
      queueJumpHighlight(postId);

      if (index !== undefined) {
        scheduleScrollCommand({
          align: "center",
          kind: "post",
          postId,
          smooth: shouldAnimateNavigation,
        });
        requestAnimationFrame(() => {
          maybeActivateJumpHighlight();
        });
        return;
      }

      requestFocusedTimeline({
        onRejected: () => {
          clearJumpHighlight();
          setConversationIntent({ kind: "live" });
        },
        postId,
        targetKind: "jump",
        nextIntent: { kind: "jump", postId },
      });
    },
    [
      clearJumpHighlight,
      latestConversationView,
      maybeActivateJumpHighlight,
      persistConversationView,
      postIdToIndex,
      pushCurrentViewToBackStack,
      queueJumpHighlight,
      requestFocusedTimeline,
      resetDetachedFlow,
      scheduleScrollCommand,
      shouldAnimateNavigation,
    ]
  );

  /** Returns the conversation to the live latest-post edge. */
  const scrollToLatest = useCallback(() => {
    clearJumpHistory();
    clearJumpHighlight();

    showLatestEdge();
  }, [clearJumpHighlight, clearJumpHistory, showLatestEdge]);

  /** Returns the conversation to the most recent transient pre-jump position. */
  const goBack = useCallback(() => {
    const view = takeBackView();

    if (!view) {
      return;
    }

    if (view.kind === "bottom") {
      clearJumpHighlight();
      showLatestEdge();
      return;
    }

    resetDetachedFlow();

    if (
      restoreConversationViewLocally(view, { smooth: shouldAnimateNavigation })
    ) {
      return;
    }

    if (view.postId === null) {
      persistConversationView(view);
      return;
    }

    latestConversationView.current = view;
    requestFocusedTimeline({
      onRejected: () => {
        persistConversationView(view);
      },
      postId: view.postId,
      targetKind: "restore",
      nextIntent: { kind: "restore", postId: view.postId, view },
    });
  }, [
    clearJumpHighlight,
    latestConversationView,
    persistConversationView,
    requestFocusedTimeline,
    resetDetachedFlow,
    restoreConversationViewLocally,
    shouldAnimateNavigation,
    showLatestEdge,
    takeBackView,
  ]);

  const forumScrollValue = useMemo(
    () => ({ jumpToPostId, scrollToLatest }),
    [jumpToPostId, scrollToLatest]
  );

  /** Persists the latest fallback snapshot when the conversation hides. */
  useLayoutEffect(
    () => () => {
      const latestView = captureConversationView({
        items: latestItemsRef.current,
        scrollRef,
      });

      if (latestView) {
        latestConversationView.current = latestView;
        persistConversationView(latestView);
      } else {
        persistConversationView();
      }

      clearJumpHistory();
      cancelPendingJumpRequest();
      clearJumpHighlight();
      pendingLatestSessionRef.current = false;
      resetScrollState();
    },
    [
      cancelPendingJumpRequest,
      clearJumpHighlight,
      clearJumpHistory,
      latestConversationView,
      persistConversationView,
      resetScrollState,
    ]
  );

  return {
    acknowledgeUnreadCue,
    canGoBack,
    forumScrollValue,
    goBack,
    handleScroll,
    handleScrollEnd,
    handleVirtualAnchorReady,
    highlightedPostId,
    initialAnchor,
    isAtBottom,
    isAtLatestEdge,
    isConversationRevealed,
    isInitialLoading,
    isPrepending,
    items,
    scrollRef,
    scrollToLatest,
    timelineSessionVersion,
  };
}
