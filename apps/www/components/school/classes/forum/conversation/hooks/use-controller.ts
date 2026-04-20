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
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useItems } from "@/components/school/classes/forum/conversation/hooks/use-items";
import { usePosts } from "@/components/school/classes/forum/conversation/hooks/use-posts";
import { useRead } from "@/components/school/classes/forum/conversation/hooks/use-read";
import { useScroll } from "@/components/school/classes/forum/conversation/hooks/use-scroll";
import { useUnread } from "@/components/school/classes/forum/conversation/hooks/use-unread";
import type {
  Forum,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import {
  clearBackStack,
  peekBackView,
  popBackView,
  pushBackView,
} from "@/components/school/classes/forum/conversation/utils/back-stack";
import {
  createFocusedTimelineState,
  createFocusedWindowArgs,
} from "@/components/school/classes/forum/conversation/utils/focused";
import {
  createForumConversationMode,
  type ForumConversationMode,
  isConversationViewAtOrAfter,
} from "@/components/school/classes/forum/conversation/utils/view";
import { useForum, useForumStoreApi } from "@/lib/context/use-forum";
import type { ForumConversationView } from "@/lib/store/forum";

const FORUM_JUMP_HIGHLIGHT_DURATION = 1600;

/** Returns whether one semantic conversation view is safe to keep as jump-back history. */
function isBackTarget(view: ForumConversationView | null) {
  return view !== null;
}

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
  handleInitialAnchorSettled: () => void;
  handleScroll: (offset: number) => void;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  initialAnchor: VirtualConversationAnchor | null;
  isAtBottom: boolean;
  isAtLatestEdge: boolean;
  isInitialLoading: boolean;
  items: VirtualItem[];
  scrollRef: RefObject<VirtualConversationHandle | null>;
  scrollToLatest: () => void;
  timelineSessionVersion: number;
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
  const [canGoBack, setCanGoBack] = useState(false);
  const backStackRef = useRef<ForumConversationView[]>(clearBackStack());
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
  const lastPostId = posts.at(-1)?._id;
  const newestLoadedPostId = lastPostId ?? null;
  const oldestLoadedPostId = posts[0]?._id ?? null;
  const latestConversationView = useRef<ForumConversationView | null>(
    savedConversationView
  );
  const persistConversationView = useCallback(
    (view?: ForumConversationView | null) => {
      const nextView = view ?? latestConversationView.current;

      if (!nextView) {
        return;
      }

      latestConversationView.current = nextView;
      saveConversationView(forumId, nextView);
    },
    [forumId, saveConversationView]
  );
  const applyBackStack = useCallback((backStack: ForumConversationView[]) => {
    backStackRef.current = backStack;
    setCanGoBack(backStack.length > 0);
  }, []);
  const clearJumpHistory = useCallback(() => {
    applyBackStack(clearBackStack());
  }, [applyBackStack]);
  const pruneReachedBackHistory = useCallback(
    (currentView: ForumConversationView | null) => {
      if (!currentView) {
        return;
      }

      let nextBackStack = backStackRef.current;

      while (true) {
        const targetView = peekBackView(nextBackStack);

        if (
          !(
            targetView &&
            isConversationViewAtOrAfter({
              currentView,
              postIdToIndex,
              targetView,
            })
          )
        ) {
          break;
        }

        nextBackStack = popBackView(nextBackStack).backStack;
      }

      if (nextBackStack === backStackRef.current) {
        return;
      }

      applyBackStack(nextBackStack);
    },
    [applyBackStack, postIdToIndex]
  );
  const takeBackView = useCallback(() => {
    const { backStack, view } = popBackView(backStackRef.current);

    if (!(view && isBackTarget(view))) {
      return null;
    }

    applyBackStack(backStack);
    return view;
  }, [applyBackStack]);
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
    handleInitialAnchorSettled,
    initialAnchor,
    isPostVisible,
    isAtBottom,
    markPendingBottomPersistence,
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
    onHighlightVisiblePost: (postId) => {
      pendingJumpHighlightPostIdRef.current = null;
      clearJumpHighlightTimeout();
      setHighlightedPostId(postId);
      startJumpHighlightTimeout();
    },
    pendingHighlightPostIdRef: pendingJumpHighlightPostIdRef,
    pendingLatestSessionRef,
    persistConversationView,
    postIdToIndex,
    scheduleMarkRead,
    scrollRef,
    timelineSessionVersion,
    unreadPostId: unreadCue?.postId ?? null,
  });

  /** Highlights one jump target immediately when it is already visible. */
  const highlightVisibleJumpTarget = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      if (!isPostVisible(postId)) {
        return false;
      }

      pendingJumpHighlightPostIdRef.current = null;
      clearJumpHighlightTimeout();
      setHighlightedPostId(postId);
      startJumpHighlightTimeout();
      return true;
    },
    [clearJumpHighlightTimeout, isPostVisible, startJumpHighlightTimeout]
  );

  /** Pushes the current semantic viewport so a detached jump can return here. */
  const pushCurrentViewToBackStack = useCallback(() => {
    const currentView =
      captureCurrentConversationView() ?? latestConversationView.current;

    if (!(currentView && isBackTarget(currentView))) {
      return;
    }

    applyBackStack(
      pushBackView({
        backStack: backStackRef.current,
        view: currentView,
      })
    );
  }, [applyBackStack, captureCurrentConversationView]);
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
      nextIntent: Extract<ForumConversationMode, { kind: "jump" | "restore" }>;
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

        if (nextIntent.kind === "jump") {
          pushCurrentViewToBackStack();
        }

        replaceWithFocusedTimeline(
          createFocusedTimelineState({
            aroundResult,
            targetKind: nextIntent.kind,
          })
        );
      } catch {
        if (jumpRequestIdRef.current !== requestId) {
          return;
        }

        onRejected();
      }
    },
    [
      beginPendingJumpRequest,
      convex,
      forumId,
      pushCurrentViewToBackStack,
      replaceWithFocusedTimeline,
    ]
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
        requestAnimationFrame(() => {
          highlightVisibleJumpTarget(postId);
        });
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
      highlightVisibleJumpTarget,
      persistConversationView,
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

  /** Persists and clears transcript state only when the controller truly unmounts. */
  const handleControllerUnmount = useEffectEvent(() => {
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
  });

  /** Runs the final controller cleanup exactly once for the mounted conversation. */
  useLayoutEffect(
    () => () => {
      handleControllerUnmount();
    },
    []
  );

  return {
    acknowledgeUnreadCue,
    canGoBack,
    containerRef,
    forumScrollValue,
    goBack,
    handleScroll: handleTranscriptScroll,
    handleInitialAnchorSettled,
    highlightedPostId,
    initialAnchor,
    isAtBottom,
    isAtLatestEdge,
    isInitialLoading,
    items,
    scrollRef,
    scrollToLatest,
    timelineSessionVersion,
  };
}
