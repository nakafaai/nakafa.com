"use client";

import { usePrevious } from "@mantine/hooks";
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
import { useItems } from "@/components/school/classes/forum/conversation/hooks/use-items";
import { usePosts } from "@/components/school/classes/forum/conversation/hooks/use-posts";
import { useRead } from "@/components/school/classes/forum/conversation/hooks/use-read";
import type {
  Forum,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import {
  type BackStack,
  clearBackStack,
  popBackView,
  pushBackView,
} from "@/components/school/classes/forum/conversation/utils/back-stack";
import {
  createFocusedTimelineState,
  createFocusedWindowArgs,
} from "@/components/school/classes/forum/conversation/utils/focused";
import {
  createPendingPostTarget,
  type PendingPostTarget,
  resolvePendingPostTargetProgress,
} from "@/components/school/classes/forum/conversation/utils/post-target";
import {
  resolveScrollCommand,
  type ScrollCommand,
  shouldPersistBottomConversationView,
} from "@/components/school/classes/forum/conversation/utils/scroll-command";
import { getForumPrefetchDistance } from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import {
  captureConversationView,
  createForumConversationMode,
  createInitialConversationAnchor,
  createInitialConversationView,
  createRestoreConversationAnchor,
  type ForumConversationMode,
  type RestorableConversationView,
} from "@/components/school/classes/forum/conversation/utils/view";
import { useForum, useForumStoreApi } from "@/lib/context/use-forum";
import type { ForumConversationView } from "@/lib/store/forum";

const FORUM_READ_STATE_NEAR_BOTTOM_THRESHOLD = 50;

interface ForumScrollValue {
  jumpToPostId: (postId: Id<"schoolClassForumPosts">) => void;
  scrollToLatest: () => void;
}

interface UseControllerResult {
  canGoBack: boolean;
  forumScrollValue: ForumScrollValue;
  goBack: () => void;
  handleScroll: (offset: number) => void;
  handleScrollEnd: () => void;
  handleVirtualAnchorReady: () => void;
  hasPendingPostTarget: boolean;
  initialAnchor: VirtualConversationAnchor;
  isAtLatestEdge: boolean;
  isInitialLoading: boolean;
  isPrepending: boolean;
  items: VirtualItem[];
  scrollRef: RefObject<VirtualConversationHandle | null>;
  scrollToLatest: () => void;
  timelineSessionVersion: number;
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
  const latestConversationView = useRef<ForumConversationView | null>(
    forumStore.getState().savedConversationViews[forumId] ?? null
  );
  const [conversationIntent, setConversationIntent] =
    useState<ForumConversationMode>(() =>
      createForumConversationMode({
        restoreView: latestConversationView.current,
      })
    );
  const initialAnchorSettledRef = useRef(false);
  const persistBottomOnArrivalRef = useRef(false);
  const [scrollCommand, setScrollCommand] = useState<ScrollCommand | null>(
    null
  );
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

  const { dateToIndex, headerIndex, items, postIdToIndex, unreadIndex } =
    useItems({
      baselineLatestPostId: baselineLatestPostIdRef.current,
      forum,
      isDetachedMode: !isAtLatestEdge,
      posts,
    });
  const latestItemsRef = useRef(items);
  latestItemsRef.current = items;

  const [canGoBack, setCanGoBack] = useState(false);
  const backStackRef = useRef<BackStack>(clearBackStack());
  const [hasPendingPostTarget, setHasPendingPostTarget] = useState(false);
  const pendingPostTargetRef = useRef<PendingPostTarget | null>(null);
  const jumpRequestIdRef = useRef(0);
  const pendingLatestSessionRef = useRef(false);
  const previousTimelineSessionVersionRef = useRef(timelineSessionVersion);

  const scrollRef = useRef<VirtualConversationHandle>(null);
  const [isPrepending, setIsPrepending] = useState(false);
  const previousScrollOffsetRef = useRef(0);
  const wasInBottomPrefetchZoneRef = useRef(false);
  const wasInTopPrefetchZoneRef = useRef(false);

  /** Resets transient scroll refs whenever one semantic transcript session remounts. */
  function resetTimelineSessionState() {
    initialAnchorSettledRef.current = false;
    persistBottomOnArrivalRef.current = pendingLatestSessionRef.current;
    previousScrollOffsetRef.current = 0;
    wasInTopPrefetchZoneRef.current = false;
    wasInBottomPrefetchZoneRef.current = false;
  }

  if (previousTimelineSessionVersionRef.current !== timelineSessionVersion) {
    previousTimelineSessionVersionRef.current = timelineSessionVersion;
    resetTimelineSessionState();
  }

  /** Resolves the fresh-mount anchor for the current transcript session. */
  const initialAnchor: VirtualConversationAnchor =
    pendingLatestSessionRef.current
      ? { kind: "bottom" }
      : createInitialConversationAnchor({
          dateToIndex,
          existingView: latestConversationView.current,
          headerIndex,
          mode: conversationIntent,
          postIdToIndex,
          unreadIndex,
        });

  const lastPostId = posts.at(-1)?._id;
  const previousLastPostId = usePrevious(lastPostId);
  const { cancelPendingMarkRead, flushMarkRead, scheduleMarkRead } = useRead({
    forumId,
  });

  /** Captures the current session-restorable viewport into one local ref. */
  const captureCurrentConversationView = useCallback(
    (offset?: number) => {
      const view = captureConversationView({ items, offset, scrollRef });

      if (!view) {
        return null;
      }

      latestConversationView.current = view;
      return view;
    },
    [items]
  );

  /** Saves the latest session-restorable conversation snapshot when needed. */
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

  /** Returns whether one captured view is safe to use as a transient back target. */
  const isBackTarget = useCallback((view: ForumConversationView | null) => {
    if (!view) {
      return false;
    }

    if (view.kind === "bottom") {
      return true;
    }

    return view.postId !== null;
  }, []);

  /** Applies one new transient back stack and keeps the UI flag in sync. */
  const applyBackStack = useCallback((backStack: BackStack) => {
    backStackRef.current = backStack;
    setCanGoBack(backStack.length > 0);
  }, []);

  /** Clears the transient jump-back history after the user returns to latest. */
  const clearJumpHistory = useCallback(() => {
    applyBackStack(clearBackStack());
  }, [applyBackStack]);

  /** Pushes the current viewport snapshot so the next reply jump can return here. */
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
  }, [applyBackStack, captureCurrentConversationView, isBackTarget]);

  /** Registers one post target that must visibly land before settling the conversation. */
  const registerPendingPostTarget = useCallback(
    (pendingPostTarget: PendingPostTarget) => {
      pendingPostTargetRef.current = pendingPostTarget;
      setHasPendingPostTarget(true);
    },
    []
  );

  /** Clears the current pending post target after it lands or the flow changes. */
  const clearPendingPostTarget = useCallback(() => {
    if (!pendingPostTargetRef.current) {
      return;
    }

    pendingPostTargetRef.current = null;
    setHasPendingPostTarget(false);
  }, []);

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

  /** Ensures the current pending post target is visible before the conversation can settle. */
  const settlePendingPostTarget = useCallback(() => {
    const progress = resolvePendingPostTargetProgress({
      handle: scrollRef.current,
      pendingPostTarget: pendingPostTargetRef.current,
      postIdToIndex,
    });

    if (progress.kind === "idle") {
      return true;
    }

    if (progress.kind === "settled") {
      clearPendingPostTarget();
      return true;
    }

    if (progress.kind === "waiting") {
      return false;
    }

    pendingPostTargetRef.current = progress.nextPendingPostTarget;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToIndex(progress.index, {
        align: progress.align,
        offset: progress.offset,
      });
    });
    return false;
  }, [clearPendingPostTarget, postIdToIndex]);

  /** Commits a confirmed latest-edge landing into the persisted view store. */
  const persistBottomConversationView = useCallback(() => {
    const bottomView = { kind: "bottom" } satisfies ForumConversationView;

    persistBottomOnArrivalRef.current = false;
    latestConversationView.current = bottomView;
    persistConversationView(bottomView);
  }, [persistConversationView]);

  /** Persists a latest-edge command only after the viewport actually reaches bottom. */
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

  /** Opens a post directly or switches the conversation into jump mode. */
  const jumpToPostId = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      const index = postIdToIndex.get(postId);
      const pendingPostTarget = createPendingPostTarget({
        align: "center",
        postId,
        reason:
          index === undefined ? "jump-session" : "in-session-post-command",
      });
      const nextView = {
        kind: "post",
        offset: 0,
        postId,
      } satisfies ForumConversationView;

      pushCurrentViewToBackStack();
      latestConversationView.current = nextView;
      persistConversationView(nextView);

      cancelPendingJumpRequest();
      pendingLatestSessionRef.current = false;
      persistBottomOnArrivalRef.current = false;
      registerPendingPostTarget(pendingPostTarget);

      if (index !== undefined) {
        setScrollCommand({
          align: "center",
          kind: "post",
          postId,
        });
        return;
      }

      const jumpRequestId = beginPendingJumpRequest();

      setScrollCommand(null);
      setConversationIntent({ kind: "jump", postId });
      convex
        .query(
          api.classes.forums.queries.around.getForumPostsAround,
          createFocusedWindowArgs({
            forumId,
            targetPostId: postId,
          })
        )
        .then((aroundResult) => {
          if (jumpRequestIdRef.current !== jumpRequestId) {
            return;
          }

          replaceWithFocusedTimeline(
            createFocusedTimelineState({
              aroundResult,
              targetKind: "jump",
            })
          );
        })
        .catch(() => {
          if (jumpRequestIdRef.current !== jumpRequestId) {
            return;
          }

          clearPendingPostTarget();
          setConversationIntent({ kind: "live" });
        });
    },
    [
      beginPendingJumpRequest,
      cancelPendingJumpRequest,
      clearPendingPostTarget,
      convex,
      forumId,
      persistConversationView,
      postIdToIndex,
      registerPendingPostTarget,
      replaceWithFocusedTimeline,
      pushCurrentViewToBackStack,
    ]
  );

  /** Returns the conversation to the live latest-post edge. */
  const scrollToLatest = useCallback(() => {
    persistBottomOnArrivalRef.current = true;
    cancelPendingJumpRequest();
    clearPendingPostTarget();
    clearJumpHistory();

    if (isAtLatestEdge) {
      pendingLatestSessionRef.current = false;
      scrollRef.current?.scrollToBottom();
      return;
    }

    pendingLatestSessionRef.current = true;
    setScrollCommand(null);
    setConversationIntent({ kind: "live" });
    showLatestPosts();
  }, [
    cancelPendingJumpRequest,
    clearPendingPostTarget,
    clearJumpHistory,
    isAtLatestEdge,
    showLatestPosts,
  ]);

  /** Restores one saved semantic view locally when its anchor is already loaded. */
  const restoreConversationViewLocally = useCallback(
    (view: RestorableConversationView) => {
      const anchor = createRestoreConversationAnchor({
        dateToIndex,
        headerIndex,
        postIdToIndex,
        unreadIndex,
        view,
      });

      if (!anchor) {
        return false;
      }

      latestConversationView.current = view;
      persistConversationView(view);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToIndex(anchor.index, {
          align: anchor.align,
          offset: anchor.offset,
        });
      });
      return true;
    },
    [
      dateToIndex,
      headerIndex,
      persistConversationView,
      postIdToIndex,
      unreadIndex,
    ]
  );

  /** Returns the conversation to the most recent transient pre-jump position. */
  const goBack = useCallback(() => {
    const { backStack, view } = popBackView(backStackRef.current);

    if (!(view && isBackTarget(view))) {
      return;
    }

    applyBackStack(backStack);
    cancelPendingJumpRequest();
    clearPendingPostTarget();
    pendingLatestSessionRef.current = false;
    persistBottomOnArrivalRef.current = false;
    setScrollCommand(null);

    if (view.kind === "bottom") {
      scrollToLatest();
      return;
    }

    if (restoreConversationViewLocally(view)) {
      return;
    }

    if (view.postId === null) {
      persistConversationView(view);
      return;
    }

    const restoreRequestId = beginPendingJumpRequest();

    latestConversationView.current = view;
    setConversationIntent({ kind: "restore", postId: view.postId, view });
    convex
      .query(
        api.classes.forums.queries.around.getForumPostsAround,
        createFocusedWindowArgs({
          forumId,
          targetPostId: view.postId,
        })
      )
      .then((aroundResult) => {
        if (jumpRequestIdRef.current !== restoreRequestId) {
          return;
        }

        replaceWithFocusedTimeline(
          createFocusedTimelineState({
            aroundResult,
            targetKind: "restore",
          })
        );
      })
      .catch(() => {
        if (jumpRequestIdRef.current !== restoreRequestId) {
          return;
        }

        persistConversationView(view);
      });
  }, [
    applyBackStack,
    beginPendingJumpRequest,
    cancelPendingJumpRequest,
    clearPendingPostTarget,
    convex,
    forumId,
    isBackTarget,
    persistConversationView,
    replaceWithFocusedTimeline,
    restoreConversationViewLocally,
    scrollToLatest,
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
  }, [conversationIntent.kind, hasPendingPostTarget, isAtLatestEdge]);

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
  }, [postIdToIndex, scrollCommand]);

  /** Marks the thread as read only while the live edge remains visible. */
  const handleScroll = useCallback(
    (offset: number) => {
      if (pendingPostTargetRef.current) {
        previousScrollOffsetRef.current = offset;
        return;
      }

      if (initialAnchorSettledRef.current) {
        captureCurrentConversationView(offset);
      }

      const handle = scrollRef.current;
      const atBottom = handle?.isAtBottom() ?? false;
      const isNearReadBottom = isNearReadStateBottom(handle);
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
      const shouldLoadOlder =
        hasMoreBefore &&
        !isLoadingOlder &&
        isMovingUp &&
        isNearTop &&
        !wasInTopPrefetchZoneRef.current;
      const shouldLoadNewer =
        hasMoreAfter &&
        !isLoadingNewer &&
        isMovingDown &&
        isNearPrefetchBottom &&
        !wasInBottomPrefetchZoneRef.current;

      previousScrollOffsetRef.current = offset;
      wasInTopPrefetchZoneRef.current = isNearTop;
      wasInBottomPrefetchZoneRef.current = isNearPrefetchBottom;

      if (shouldLoadOlder) {
        setIsPrepending(true);
        loadOlderPosts();
      }

      if (shouldLoadNewer) {
        loadNewerPosts();
      }

      if (!(isNearReadBottom && isAtLatestEdge)) {
        cancelPendingMarkRead();
        return;
      }

      scheduleMarkRead(lastPostId);
    },
    [
      cancelPendingMarkRead,
      captureCurrentConversationView,
      hasMoreAfter,
      hasMoreBefore,
      isAtLatestEdge,
      isLoadingNewer,
      isLoadingOlder,
      lastPostId,
      loadNewerPosts,
      loadOlderPosts,
      maybePersistBottomConversationView,
      scheduleMarkRead,
    ]
  );

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

    const isNearReadBottom = scrollRef.current
      ? isNearReadStateBottom(scrollRef.current)
      : initialView?.kind === "bottom";

    previousScrollOffsetRef.current = scrollRef.current?.getScrollOffset() ?? 0;
    wasInTopPrefetchZoneRef.current = false;
    wasInBottomPrefetchZoneRef.current = false;

    if (!(isNearReadBottom && isAtLatestEdge)) {
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
    persistConversationView,
    scheduleMarkRead,
    unreadIndex,
  ]);

  /** Waits for any pending jump target before the forum controller settles. */
  const handleVirtualAnchorReady = useCallback(() => {
    if (!settlePendingPostTarget()) {
      return;
    }

    finalizeConversationReady();
  }, [finalizeConversationReady, settlePendingPostTarget]);

  /** Saves the latest fallback snapshot when scrolling settles or the route hides. */
  const handleScrollEnd = useCallback(() => {
    if (!settlePendingPostTarget()) {
      return;
    }

    if (!initialAnchorSettledRef.current) {
      finalizeConversationReady();
      return;
    }

    if (
      maybePersistBottomConversationView(
        scrollRef.current?.isAtBottom() ?? false
      )
    ) {
      return;
    }

    persistConversationView(captureCurrentConversationView());
  }, [
    captureCurrentConversationView,
    finalizeConversationReady,
    maybePersistBottomConversationView,
    persistConversationView,
    settlePendingPostTarget,
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

      pendingPostTargetRef.current = null;
      clearJumpHistory();
      cancelPendingJumpRequest();
      pendingLatestSessionRef.current = false;
      persistBottomOnArrivalRef.current = false;
      previousScrollOffsetRef.current = 0;
      wasInTopPrefetchZoneRef.current = false;
      wasInBottomPrefetchZoneRef.current = false;
      setScrollCommand(null);
    },
    [cancelPendingJumpRequest, clearJumpHistory, persistConversationView]
  );

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
  }, [flushMarkRead, isAtLatestEdge, lastPostId, previousLastPostId]);

  useEffect(() => {
    if (isPrepending && !isLoadingOlder) {
      setIsPrepending(false);
    }
  }, [isLoadingOlder, isPrepending]);

  return {
    canGoBack,
    forumScrollValue,
    goBack,
    handleScroll,
    handleScrollEnd,
    handleVirtualAnchorReady,
    hasPendingPostTarget,
    initialAnchor,
    isAtLatestEdge,
    isInitialLoading,
    isPrepending,
    items,
    scrollRef,
    scrollToLatest,
    timelineSessionVersion,
  };
}
