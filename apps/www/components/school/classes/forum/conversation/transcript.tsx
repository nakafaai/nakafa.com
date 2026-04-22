"use client";

import { useReducedMotion } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useConvex, useMutation, useQueries } from "convex/react";
import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { VirtualizerHandle } from "virtua";
import { useControls } from "@/components/school/classes/forum/conversation/context/use-controls";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { useSession } from "@/components/school/classes/forum/conversation/context/use-session";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";
import {
  createConversationRows,
  createTranscriptQueryRequests,
  FORUM_BOTTOM_THRESHOLD,
  FORUM_TOP_LOAD_THRESHOLD,
  flattenConversationPosts,
  getForumPostsWindowResult,
  getLastConversationPostId,
  type TranscriptWindow,
} from "@/components/school/classes/forum/conversation/data/pages";
import { getConversationBottomDistance } from "@/components/school/classes/forum/conversation/data/settled-view";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";
import {
  canExecuteConversationScrollRequest,
  settleConversationRestore,
} from "@/components/school/classes/forum/conversation/utils/restore";
import {
  type ConversationScrollRequest,
  commitConversationView,
  executeConversationScrollRequest,
  getCurrentConversationView as readCurrentConversationView,
  scrollConversationToBottom,
  syncConversationViewport,
} from "@/components/school/classes/forum/conversation/utils/scroll";
import {
  buildConversationRestore,
  getConversationJumpRestore,
  getNextNewerConversationWindow,
  getNextOlderConversationWindow,
  hasLoadedConversationWindow,
} from "@/components/school/classes/forum/conversation/utils/windows";
import { ConversationVirtualizer } from "@/components/school/classes/forum/conversation/virtualizer";

export const ForumConversationTranscript = memo(() => {
  const convex = useConvex();
  const forum = useData((state) => state.forum);
  const forumId = useData((state) => state.forumId);
  const { registerControls } = useControls();
  const isHydrated = useSession((state) => state.isHydrated);
  const saveView = useSession((state) => state.saveConversationView);
  const savedView = useSession(
    (state) => state.savedConversationViews[forumId] ?? null
  );
  const backOrigin = useViewport((state) => state.backOrigin);
  const clearBackOrigin = useViewport((state) => state.clearBackOrigin);
  const isAtBottom = useViewport((state) => state.isAtBottom);
  const mode = useViewport((state) => state.mode);
  const setBackOrigin = useViewport((state) => state.setBackOrigin);
  const setMode = useViewport((state) => state.setMode);
  const updateViewport = useViewport((state) => state.updateViewport);
  const prefersReducedMotion = useReducedMotion();
  const markForumRead = useMutation(
    api.classes.forums.mutations.readState.markForumRead
  );
  const [queryError, setQueryError] = useState<Error | null>(null);
  const [windows, setWindows] = useState<TranscriptWindow[]>([]);
  const [newerWindowId, setNewerWindowId] = useState<string | null>(null);
  const [olderWindowId, setOlderWindowId] = useState<string | null>(null);
  const [scrollRequest, setScrollRequest] =
    useState<ConversationScrollRequest | null>(null);
  const activeRestoreRef = useRef<ConversationScrollRequest | null>(null);
  const didBootstrapRef = useRef(false);
  const handleRef = useRef<VirtualizerHandle | null>(null);
  const lastMarkedPostIdRef = useRef<string | null>(null);
  const lastPostIdRef = useRef<string | null>(null);
  const restoreRequestIdRef = useRef(0);
  const correctionCountRef = useRef(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const settledViewRef = useRef<ConversationView | null>(null);
  const queryRequests = useMemo(
    () => createTranscriptQueryRequests(windows),
    [windows]
  );
  const queryResults = useQueries(queryRequests);
  const posts = useMemo(
    () => flattenConversationPosts(windows, queryResults),
    [queryResults, windows]
  );
  const hasLoadedWindow = useMemo(
    () =>
      windows.some((window) =>
        getForumPostsWindowResult(queryResults[window.id])
      ),
    [queryResults, windows]
  );
  const isWaitingForOlderWindow = useMemo(
    () =>
      !!(
        olderWindowId &&
        !hasLoadedConversationWindow({
          queryResults,
          windowId: olderWindowId,
        })
      ),
    [olderWindowId, queryResults]
  );
  const rows = useMemo(
    () => createConversationRows({ forum, posts }),
    [forum, posts]
  );
  const lastPostId = useMemo(() => getLastConversationPostId(posts), [posts]);

  const throwQueryError = useCallback((error: unknown) => {
    setQueryError(
      error instanceof Error
        ? error
        : new Error(String(error ?? "Unknown error"))
    );
  }, []);

  const markLastPostRead = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      if (lastMarkedPostIdRef.current === postId) {
        return;
      }
      lastMarkedPostIdRef.current = postId;
      markForumRead({ forumId, lastReadPostId: postId }).catch(() => undefined);
    },
    [forumId, markForumRead]
  );

  const syncViewportState = useCallback(
    () =>
      syncConversationViewport({
        handle: handleRef.current,
        threshold: FORUM_BOTTOM_THRESHOLD,
        updateViewport,
      }),
    [updateViewport]
  );

  const getCurrentConversationView = useCallback(
    () =>
      readCurrentConversationView({
        handle: handleRef.current,
        hasLoadedWindow,
        rows,
        settledView: settledViewRef.current,
      }),
    [hasLoadedWindow, rows]
  );

  const commitSettledView = useCallback(() => {
    commitConversationView({
      backOrigin,
      clearBackOrigin,
      forumId,
      handle: handleRef.current,
      hasLoadedWindow,
      lastPostId,
      markLastPostRead,
      rows,
      saveConversationView: saveView,
      settledViewRef,
    });
  }, [
    backOrigin,
    clearBackOrigin,
    forumId,
    hasLoadedWindow,
    lastPostId,
    markLastPostRead,
    rows,
    saveView,
  ]);

  const scrollToBottom = useCallback(
    (smooth: boolean) =>
      scrollConversationToBottom({
        handle: handleRef.current,
        rowsLength: rows.length,
        smooth,
      }),
    [rows.length]
  );

  const settleRestore = useEffectEvent(() => {
    const request = activeRestoreRef.current;
    if (!request) {
      syncViewportState();
      commitSettledView();
      return;
    }
    syncViewportState();
    const nextRestore = settleConversationRestore({
      correctionCount: correctionCountRef.current,
      handle: handleRef.current,
      request,
      rows,
    });
    if (!nextRestore.settled) {
      correctionCountRef.current = nextRestore.correctionCount;
      requestAnimationFrame(() => {
        settleRestore();
      });
      return;
    }
    activeRestoreRef.current = null;
    correctionCountRef.current = 0;
    commitSettledView();
  });

  const pinLatestPost = useEffectEvent(() => {
    if (!scrollToBottom(false)) {
      return;
    }
    requestAnimationFrame(() => {
      syncViewportState();
      commitSettledView();
    });
  });

  const restoreConversation = useCallback(
    async ({
      exact,
      smooth,
      view,
    }: {
      exact: boolean;
      smooth: boolean;
      view: ConversationView;
    }) => {
      restoreRequestIdRef.current += 1;
      const requestId = restoreRequestIdRef.current;
      try {
        const nextConversation = await buildConversationRestore({
          forumId,
          resolveAnchor: (postId) =>
            convex.query(api.classes.forums.queries.pages.getForumPostAnchor, {
              forumId,
              postId,
            }),
          view,
        });
        if (restoreRequestIdRef.current !== requestId) {
          return;
        }
        setMode(nextConversation.mode);
        activeRestoreRef.current = null;
        setNewerWindowId(null);
        setOlderWindowId(null);
        correctionCountRef.current = 0;
        setWindows(nextConversation.windows);
        setScrollRequest({ exact, smooth, view });
      } catch (error) {
        if (restoreRequestIdRef.current !== requestId) {
          return;
        }
        throwQueryError(error);
      }
    },
    [convex, forumId, setMode, throwQueryError]
  );

  const goToLatest = useCallback(() => {
    updateViewport({ hasPendingLatestPosts: false });
    restoreConversation({
      exact: false,
      smooth: !prefersReducedMotion,
      view: { kind: "bottom" },
    });
  }, [prefersReducedMotion, restoreConversation, updateViewport]);

  const goBack = useCallback(() => {
    if (!backOrigin) {
      return;
    }
    restoreConversation({
      exact: backOrigin.kind === "post",
      smooth: !prefersReducedMotion,
      view: backOrigin,
    });
  }, [backOrigin, prefersReducedMotion, restoreConversation]);

  const goToPost = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      const jumpRestore = getConversationJumpRestore({
        backOrigin,
        currentView: getCurrentConversationView(),
        jumpTargetPostId: postId,
      });
      if (!jumpRestore) {
        return;
      }
      if (jumpRestore.captureBackOrigin) {
        setBackOrigin(jumpRestore.captureBackOrigin);
      }
      restoreConversation({
        exact: jumpRestore.request.exact,
        smooth: !prefersReducedMotion,
        view: jumpRestore.request.view,
      });
    },
    [
      backOrigin,
      getCurrentConversationView,
      prefersReducedMotion,
      restoreConversation,
      setBackOrigin,
    ]
  );

  const prependOlderWindow = useCallback(() => {
    if (isWaitingForOlderWindow) {
      return;
    }
    const nextWindow = getNextOlderConversationWindow({
      forumId,
      queryResults,
      windows,
    });
    if (!nextWindow) {
      return;
    }
    setOlderWindowId(nextWindow.id);
    setWindows((currentWindows) => [nextWindow, ...currentWindows]);
  }, [forumId, isWaitingForOlderWindow, queryResults, windows]);

  const appendNewerWindow = useCallback(() => {
    if (
      mode !== "focused" ||
      (newerWindowId &&
        !hasLoadedConversationWindow({
          queryResults,
          windowId: newerWindowId,
        }))
    ) {
      return;
    }
    const nextWindow = getNextNewerConversationWindow({
      forumId,
      mode,
      queryResults,
      windows,
    });
    if (!nextWindow) {
      return;
    }
    setNewerWindowId(nextWindow.id);
    setWindows((currentWindows) => [...currentWindows, nextWindow]);
  }, [forumId, mode, newerWindowId, queryResults, windows]);

  const handleScroll = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) {
      return;
    }
    if (activeRestoreRef.current) {
      syncViewportState();
      return;
    }
    if (handle.scrollOffset <= FORUM_TOP_LOAD_THRESHOLD) {
      prependOlderWindow();
    }
    if (
      mode === "focused" &&
      getConversationBottomDistance(handle) <= FORUM_TOP_LOAD_THRESHOLD
    ) {
      appendNewerWindow();
    }

    syncViewportState();
  }, [appendNewerWindow, mode, prependOlderWindow, syncViewportState]);

  useEffect(() => {
    if (!(forum && isHydrated) || didBootstrapRef.current) {
      return;
    }
    didBootstrapRef.current = true;
    clearBackOrigin();
    restoreConversation({
      exact: savedView?.kind === "post",
      smooth: false,
      view: savedView ?? { kind: "bottom" },
    });
  }, [clearBackOrigin, forum, isHydrated, restoreConversation, savedView]);

  useLayoutEffect(() => {
    registerControls({ goBack, goToLatest, goToPost });
  }, [goBack, goToLatest, goToPost, registerControls]);

  useLayoutEffect(() => {
    if (!scrollRequest) {
      return;
    }
    let cancelled = false;
    const executeRequest = () => {
      if (cancelled) {
        return;
      }
      // Virtua measures `viewportSize` through ResizeObserver, so an initial
      // restore must wait until that first measurement exists before scrolling.
      if (
        !canExecuteConversationScrollRequest({
          handle: handleRef.current,
          request: scrollRequest,
          rows,
        })
      ) {
        requestAnimationFrame(executeRequest);
        return;
      }
      if (
        !executeConversationScrollRequest({
          handle: handleRef.current,
          request: scrollRequest,
          rows,
          scrollToBottom,
        })
      ) {
        requestAnimationFrame(executeRequest);
        return;
      }
      activeRestoreRef.current = scrollRequest;
      correctionCountRef.current = 0;
      setScrollRequest(null);
      // Keep visible motion to one pass. Any late resize correction after that
      // is forced to an instant follow-up settle instead of another animation.
      if (scrollRequest.exact || !scrollRequest.smooth) {
        requestAnimationFrame(() => {
          settleRestore();
        });
      }
    };
    executeRequest();
    return () => {
      cancelled = true;
    };
  }, [rows, scrollRequest, scrollToBottom]);

  useLayoutEffect(() => {
    const previousLastPostId = lastPostIdRef.current;
    lastPostIdRef.current = lastPostId;
    if (
      !(previousLastPostId && lastPostId && previousLastPostId !== lastPostId)
    ) {
      return;
    }
    if (mode === "live" && isAtBottom) {
      updateViewport({ hasPendingLatestPosts: false });
      pinLatestPost();
      return;
    }
    updateViewport({ hasPendingLatestPosts: true });
  }, [isAtBottom, lastPostId, mode, updateViewport]);

  if (queryError) {
    throw queryError;
  }

  if (!forum) {
    return null;
  }

  return (
    <ConversationVirtualizer
      forumId={forum._id}
      handleRef={handleRef}
      isWaitingForOlderWindow={isWaitingForOlderWindow}
      onScroll={handleScroll}
      onScrollEnd={() => {
        if (activeRestoreRef.current) {
          settleRestore();
          return;
        }

        syncViewportState();
        commitSettledView();
      }}
      rows={rows}
      scrollElementRef={scrollElementRef}
    />
  );
});
ForumConversationTranscript.displayName = "ForumConversationTranscript";
