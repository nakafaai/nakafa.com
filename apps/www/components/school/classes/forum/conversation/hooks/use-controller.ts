import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  VirtualConversationAnchor,
  VirtualConversationHandle,
} from "@repo/design-system/components/ui/virtual-conversation";
import { useConvex } from "convex/react";
import {
  type RefObject,
  useCallback,
  useEffect,
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
import { useTarget } from "@/components/school/classes/forum/conversation/hooks/use-target";
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
import { createPendingPostTarget } from "@/components/school/classes/forum/conversation/utils/post-target";
import {
  captureConversationView,
  createForumConversationMode,
  type ForumConversationMode,
} from "@/components/school/classes/forum/conversation/utils/view";
import { useForum, useForumStoreApi } from "@/lib/context/use-forum";
import type { ForumConversationView } from "@/lib/store/forum";

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
  hasPendingPostTarget: boolean;
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
  const pendingLatestSessionRef = useRef(false);
  const scrollRef = useRef<VirtualConversationHandle>(null);
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
    clearPendingPostTarget,
    hasPendingPostTarget,
    pendingPostTargetRef,
    registerPendingPostTarget,
    settlePendingPostTarget,
  } = useTarget({
    postIdToIndex,
    scrollRef,
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
  const {
    clearScrollCommand,
    handleScroll,
    handleScrollEnd,
    handleVirtualAnchorReady,
    initialAnchorSettledRef,
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
    clearPendingPostTarget();
    pendingLatestSessionRef.current = false;
    resetPendingBottomPersistence();
    clearScrollCommand();
  }, [
    cancelPendingJumpRequest,
    clearPendingPostTarget,
    clearScrollCommand,
    resetPendingBottomPersistence,
  ]);

  /** Loads one focused around-post timeline and swaps the transcript when it resolves. */
  const requestFocusedTimeline = useCallback(
    ({
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
      convex
        .query(
          api.classes.forums.queries.around.getForumPostsAround,
          createFocusedWindowArgs({
            forumId,
            targetPostId: postId,
          })
        )
        .then((aroundResult) => {
          if (jumpRequestIdRef.current !== requestId) {
            return;
          }

          replaceWithFocusedTimeline(
            createFocusedTimelineState({
              aroundResult,
              targetKind,
            })
          );
        })
        .catch(() => {
          if (jumpRequestIdRef.current !== requestId) {
            return;
          }

          onRejected();
        });
    },
    [beginPendingJumpRequest, convex, forumId, replaceWithFocusedTimeline]
  );

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
      registerPendingPostTarget(
        createPendingPostTarget({
          align: "center",
          postId,
          reason:
            index === undefined ? "jump-session" : "in-session-post-command",
        })
      );

      if (index !== undefined) {
        scheduleScrollCommand({
          align: "center",
          kind: "post",
          postId,
        });
        return;
      }

      requestFocusedTimeline({
        onRejected: () => {
          clearPendingPostTarget();
          setConversationIntent({ kind: "live" });
        },
        postId,
        targetKind: "jump",
        nextIntent: { kind: "jump", postId },
      });
    },
    [
      clearPendingPostTarget,
      latestConversationView,
      persistConversationView,
      postIdToIndex,
      pushCurrentViewToBackStack,
      registerPendingPostTarget,
      requestFocusedTimeline,
      resetDetachedFlow,
      scheduleScrollCommand,
    ]
  );

  /** Returns the conversation to the live latest-post edge. */
  const scrollToLatest = useCallback(() => {
    clearJumpHistory();

    goToLatestEdge({
      cancelPendingJumpRequest,
      clearPendingPostTarget,
      clearScrollCommand,
      isAtLatestEdge,
      markPendingBottomPersistence,
      pendingLatestSessionRef,
      scrollRef,
      showLatestPosts,
      showLiveConversation: () => {
        setConversationIntent({ kind: "live" });
      },
    });
  }, [
    cancelPendingJumpRequest,
    clearPendingPostTarget,
    clearJumpHistory,
    clearScrollCommand,
    isAtLatestEdge,
    markPendingBottomPersistence,
    showLatestPosts,
  ]);

  /** Returns the conversation to the most recent transient pre-jump position. */
  const goBack = useCallback(() => {
    const view = takeBackView();

    if (!view) {
      return;
    }

    if (view.kind === "bottom") {
      goToLatestEdge({
        cancelPendingJumpRequest,
        clearPendingPostTarget,
        clearScrollCommand,
        isAtLatestEdge,
        markPendingBottomPersistence,
        pendingLatestSessionRef,
        scrollRef,
        showLatestPosts,
        showLiveConversation: () => {
          setConversationIntent({ kind: "live" });
        },
      });
      return;
    }

    resetDetachedFlow();

    if (restoreConversationViewLocally(view)) {
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
    cancelPendingJumpRequest,
    clearPendingPostTarget,
    clearScrollCommand,
    isAtLatestEdge,
    latestConversationView,
    markPendingBottomPersistence,
    persistConversationView,
    requestFocusedTimeline,
    resetDetachedFlow,
    restoreConversationViewLocally,
    showLatestPosts,
    takeBackView,
  ]);

  const forumScrollValue = useMemo(
    () => ({ jumpToPostId, scrollToLatest }),
    [jumpToPostId, scrollToLatest]
  );

  useEffect(() => {
    if (
      !(
        initialAnchorSettledRef.current &&
        !hasPendingPostTarget &&
        isAtLatestEdge &&
        conversationIntent.kind !== "live"
      )
    ) {
      return;
    }

    setConversationIntent({ kind: "live" });
  }, [
    conversationIntent.kind,
    hasPendingPostTarget,
    initialAnchorSettledRef,
    isAtLatestEdge,
  ]);

  /** Persists the latest fallback snapshot when the conversation hides. */
  useLayoutEffect(
    () => () => {
      const latestView = pendingPostTargetRef.current
        ? null
        : captureConversationView({
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
      clearPendingPostTarget();
      pendingLatestSessionRef.current = false;
      resetScrollState();
    },
    [
      cancelPendingJumpRequest,
      clearJumpHistory,
      clearPendingPostTarget,
      latestConversationView,
      pendingPostTargetRef,
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
    hasPendingPostTarget,
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
