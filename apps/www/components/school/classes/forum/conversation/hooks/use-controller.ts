import { useReducedMotion, useTimeout } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualConversationHandle } from "@repo/design-system/types/virtual";
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
  ForumPost,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import { createFocusedWindowArgs } from "@/components/school/classes/forum/conversation/utils/focused";
import { isForumPostVisible } from "@/components/school/classes/forum/conversation/utils/post-target";
import {
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
  containerRef: RefObject<HTMLDivElement | null>;
  forumScrollValue: ForumScrollValue;
  goBack: () => void;
  handleScroll: (offset: number) => void;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  isAtBottom: boolean;
  isAtLatestEdge: boolean;
  isConversationRevealed: boolean;
  isInitialLoading: boolean;
  items: VirtualItem[];
  registerPostElement: (
    postId: Id<"schoolClassForumPosts">,
    element: HTMLDivElement | null
  ) => void;
  scrollRef: RefObject<VirtualConversationHandle | null>;
  scrollToLatest: () => void;
  timelineSessionVersion: number;
}

/** Creates one direct focused timeline state from an around-window result. */
function createFocusedTimelineState({
  aroundResult,
}: {
  aroundResult: {
    hasMoreAfter: boolean;
    hasMoreBefore: boolean;
    newestPostId: Id<"schoolClassForumPosts">;
    oldestPostId: Id<"schoolClassForumPosts">;
    posts: ForumPost[];
  };
}) {
  const isAtLatestEdge = !aroundResult.hasMoreAfter;

  return {
    hasMoreAfter: aroundResult.hasMoreAfter,
    hasMoreBefore: aroundResult.hasMoreBefore,
    isAtLatestEdge,
    isJumpMode: !isAtLatestEdge,
    newestPostId: aroundResult.newestPostId,
    oldestPostId: aroundResult.oldestPostId,
    posts: aroundResult.posts,
  };
}

/** Owns the forum conversation orchestration and exposes a render-facing API. */
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
  const { items, postIdToIndex } = useItems({
    forum,
    isDetachedMode: !isAtLatestEdge,
    posts,
    unreadCue,
  });
  const latestItemsRef = useRef(items);
  latestItemsRef.current = items;
  const lastPostId = posts.at(-1)?._id;
  const newestLoadedPostId = lastPostId ?? null;
  const oldestLoadedPostId = posts[0]?._id ?? null;
  const { latestConversationView, persistConversationView } = useView({
    forumId,
    saveConversationView,
    savedConversationView,
  });
  const { cancelPendingMarkRead, flushMarkRead, scheduleMarkRead } = useRead({
    forumId,
  });
  const shouldAnimateNavigation = !prefersReducedMotion;
  const { clear: clearJumpHighlightTimeout, start: startJumpHighlightTimeout } =
    useTimeout(() => {
      setHighlightedPostId(null);
    }, FORUM_JUMP_HIGHLIGHT_DURATION);

  /** Clears any transient jump highlight that should not survive nav changes. */
  const clearJumpHighlight = useCallback(() => {
    pendingJumpHighlightPostIdRef.current = null;
    clearJumpHighlightTimeout();
    setHighlightedPostId(null);
  }, [clearJumpHighlightTimeout]);

  /** Queues one post for temporary highlight after the jump visibly settles. */
  const queueJumpHighlight = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      clearJumpHighlightTimeout();
      pendingJumpHighlightPostIdRef.current = postId;
      setHighlightedPostId(null);
    },
    [clearJumpHighlightTimeout]
  );

  const {
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
  } = useScroll({
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
    onNavigationSettled: () => {
      const postId = pendingJumpHighlightPostIdRef.current;

      if (!postId) {
        return;
      }

      const container = containerRef.current;
      const index = postIdToIndex.get(postId);

      if (!(container && index !== undefined)) {
        return;
      }

      const element = container.querySelector<HTMLDivElement>(
        `[data-forum-post-id="${postId}"]`
      );

      if (!(element && isForumPostVisible({ container, element }))) {
        return;
      }

      pendingJumpHighlightPostIdRef.current = null;
      clearJumpHighlightTimeout();
      setHighlightedPostId(postId);
      startJumpHighlightTimeout();
    },
    pendingLatestSessionRef,
    persistConversationView,
    postIdToIndex,
    scheduleMarkRead,
    scrollRef,
    timelineSessionVersion,
    unreadPostId: unreadCue?.postId ?? null,
  });
  const {
    canGoBack,
    clearJumpHistory,
    pruneReachedBackHistory,
    pushCurrentViewToBackStack,
    takeBackView,
  } = useHistory({
    captureCurrentConversationView,
    latestConversationView,
    postIdToIndex,
  });

  /** Keeps jump-back history in sync with the current visible transcript. */
  const handleTranscriptScroll = useCallback(
    (offset: number) => {
      handleScroll(offset);
      pruneReachedBackHistory(captureCurrentConversationView());
    },
    [captureCurrentConversationView, handleScroll, pruneReachedBackHistory]
  );

  /** Invalidates any stale unloaded jump request before a new intent takes over. */
  const cancelPendingJumpRequest = useCallback(() => {
    jumpRequestIdRef.current += 1;
  }, []);

  /** Starts one unloaded jump request and returns the token used to accept it. */
  const beginPendingJumpRequest = useCallback(() => {
    const requestId = jumpRequestIdRef.current + 1;

    jumpRequestIdRef.current = requestId;
    return requestId;
  }, []);

  /** Clears transient jump-flow state before another navigation takes over. */
  const resetDetachedFlow = useCallback(() => {
    cancelPendingJumpRequest();
    clearJumpHighlight();
    pendingLatestSessionRef.current = false;
    resetPendingBottomPersistence();
  }, [
    cancelPendingJumpRequest,
    clearJumpHighlight,
    resetPendingBottomPersistence,
  ]);

  /** Loads one focused around-post window and swaps the transcript when ready. */
  const requestFocusedTimeline = useCallback(
    async ({
      onRejected,
      postId,
      nextIntent,
    }: {
      onRejected: () => void;
      postId: Id<"schoolClassForumPosts">;
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
    cancelPendingJumpRequest();
    markPendingBottomPersistence();
    clearJumpHighlight();

    if (isAtLatestEdge) {
      pendingLatestSessionRef.current = false;
      scrollToBottom({ smooth: shouldAnimateNavigation });
      return;
    }

    pendingLatestSessionRef.current = true;
    showLatestPosts();
    setConversationIntent({ kind: "live" });
  }, [
    cancelPendingJumpRequest,
    clearJumpHighlight,
    isAtLatestEdge,
    markPendingBottomPersistence,
    scrollToBottom,
    shouldAnimateNavigation,
    showLatestPosts,
  ]);

  /** Opens a post directly or switches the transcript into focused jump mode. */
  const jumpToPostId = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
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

      if (
        scrollToPost(postId, {
          align: "center",
          smooth: shouldAnimateNavigation,
        })
      ) {
        return;
      }

      requestFocusedTimeline({
        onRejected: () => {
          clearJumpHighlight();
          setConversationIntent({ kind: "live" });
        },
        postId,
        nextIntent: { kind: "jump", postId },
      });
    },
    [
      clearJumpHighlight,
      latestConversationView,
      persistConversationView,
      pushCurrentViewToBackStack,
      queueJumpHighlight,
      requestFocusedTimeline,
      resetDetachedFlow,
      scrollToPost,
      shouldAnimateNavigation,
    ]
  );

  /** Returns the conversation to the live latest-post edge. */
  const scrollToLatest = useCallback(() => {
    clearJumpHistory();
    showLatestEdge();
  }, [clearJumpHistory, showLatestEdge]);

  /** Returns the conversation to the most recent transient pre-jump position. */
  const goBack = useCallback(() => {
    const view = takeBackView();

    if (!view) {
      return;
    }

    if (view.kind === "bottom") {
      showLatestEdge();
      return;
    }

    resetDetachedFlow();

    if (
      scrollToPost(view.postId, {
        align: "start",
        offset: view.offset,
        smooth: shouldAnimateNavigation,
      })
    ) {
      latestConversationView.current = view;
      persistConversationView(view);
      return;
    }

    latestConversationView.current = view;
    requestFocusedTimeline({
      onRejected: () => {
        persistConversationView(view);
      },
      postId: view.postId,
      nextIntent: { kind: "restore", postId: view.postId, view },
    });
  }, [
    latestConversationView,
    persistConversationView,
    requestFocusedTimeline,
    resetDetachedFlow,
    scrollToPost,
    shouldAnimateNavigation,
    showLatestEdge,
    takeBackView,
  ]);

  const forumScrollValue = useMemo(
    () => ({ jumpToPostId, scrollToLatest }),
    [jumpToPostId, scrollToLatest]
  );

  /** Keeps jump-back history in sync with the currently visible transcript view. */
  useLayoutEffect(() => {
    const currentView = captureCurrentConversationView();
    pruneReachedBackHistory(currentView);
  }, [captureCurrentConversationView, pruneReachedBackHistory]);

  /** Persists the latest transcript snapshot when the conversation unmounts. */
  useLayoutEffect(
    () => () => {
      const latestView = captureCurrentConversationView();

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
      captureCurrentConversationView,
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
    containerRef,
    forumScrollValue,
    goBack,
    handleScroll: handleTranscriptScroll,
    highlightedPostId,
    isAtBottom,
    isAtLatestEdge,
    isConversationRevealed,
    isInitialLoading,
    items,
    registerPostElement,
    scrollRef,
    scrollToLatest,
    timelineSessionVersion,
  };
}
