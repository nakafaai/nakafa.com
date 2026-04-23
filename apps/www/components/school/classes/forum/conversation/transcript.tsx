"use client";

import {
  useDebouncedCallback,
  useReducedMotion,
  useTimeout,
} from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useMutation } from "convex/react";
import { memo, useCallback, useMemo, useRef } from "react";
import { useControls } from "@/components/school/classes/forum/conversation/context/use-controls";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { useSession } from "@/components/school/classes/forum/conversation/context/use-session";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";
import {
  createConversationRows,
  FORUM_BOTTOM_THRESHOLD,
  getConversationRowKey,
} from "@/components/school/classes/forum/conversation/data/pages";
import {
  captureConversationView,
  getConversationBottomDistance,
  getLastVisibleConversationPostId,
  hasConversationViewReached,
  hasConversationViewSettledPlacement,
} from "@/components/school/classes/forum/conversation/data/settled-view";
import { useConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/unread";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";
import { isConversationViewAtPost } from "@/components/school/classes/forum/conversation/data/view";
import { JumpBar } from "@/components/school/classes/forum/conversation/jump-bar";
import { TranscriptRow } from "@/components/school/classes/forum/conversation/transcript-row";

interface PendingPlacement {
  behavior: ScrollBehavior;
  highlightPostId: Id<"schoolClassForumPosts"> | null;
  view: ConversationView;
}

/**
 * Normal-DOM transcript backed by one reactive Convex query.
 *
 * References:
 * - Convex best practices:
 *   https://docs.convex.dev/understanding/best-practices/
 * - Convex collect/query pattern:
 *   https://stack.convex.dev/fully-reactive-pagination
 * - React effect guidance:
 *   https://react.dev/learn/you-might-not-need-an-effect
 * - DOM scrolling with refs:
 *   https://react.dev/learn/manipulating-the-dom-with-refs
 */
export const ForumConversationTranscript = memo(() => {
  const forumId = useData((state) => state.forumId);
  const isHydrated = useSession((state) => state.isHydrated);
  const savedView = useSession(
    (state) => state.savedConversationViews[forumId] ?? null
  );

  if (!isHydrated) {
    return null;
  }

  /*
   * The selected forum changes inside the same mounted panel route. Keying the
   * transcript resets per-forum refs and local state exactly at the stateful
   * boundary that owns them.
   *
   * References:
   * - https://react.dev/learn/preserving-and-resetting-state
   */
  return (
    <HydratedTranscript
      forumId={forumId}
      initialSavedView={savedView}
      key={forumId}
    />
  );
});
ForumConversationTranscript.displayName = "ForumConversationTranscript";

const HydratedTranscript = memo(
  ({
    forumId,
    initialSavedView,
  }: {
    forumId: Id<"schoolClassForums">;
    initialSavedView: ConversationView | null;
  }) => {
    const forum = useData((state) => state.forum);
    const saveConversationView = useSession(
      (state) => state.saveConversationView
    );
    const backStack = useViewport((state) => state.backStack);
    const clearHighlightedPost = useViewport(
      (state) => state.clearHighlightedPost
    );
    const hasOverflow = useViewport((state) => state.hasOverflow);
    const highlightPost = useViewport((state) => state.highlightPost);
    const isAtBottom = useViewport((state) => state.isAtBottom);
    const popBackView = useViewport((state) => state.popBackView);
    const pushBackView = useViewport((state) => state.pushBackView);
    const setSettledView = useViewport((state) => state.setSettledView);
    const updateViewport = useViewport((state) => state.updateViewport);
    const { registerControls } = useControls();
    const prefersReducedMotion = useReducedMotion();
    const markForumRead = useMutation(
      api.classes.forums.mutations.readState.markForumRead
    );
    const {
      data: posts,
      error,
      isError,
      isPending,
    } = useQueryWithStatus(api.classes.forums.queries.pages.getForumPosts, {
      forumId,
    });

    const transcriptPosts = posts ?? [];
    const { acknowledgeUnreadCue, unreadCue } = useConversationUnreadCue({
      isPending,
      posts: transcriptPosts,
    });
    const rows = useMemo(
      () =>
        createConversationRows({
          forum,
          posts: transcriptPosts,
          unreadCue,
        }),
      [forum, transcriptPosts, unreadCue]
    );
    const postIds = useMemo(
      () => transcriptPosts.map((post) => post._id),
      [transcriptPosts]
    );
    const canGoBack = backStack.length > 0;
    const shouldShowJumpBar = hasOverflow && (canGoBack || !isAtBottom);
    const scrollRootRef = useRef<HTMLDivElement | null>(null);
    const contentObserverRef = useRef<ResizeObserver | null>(null);
    const pendingPlacementRef = useRef<PendingPlacement | null>({
      behavior: "auto",
      highlightPostId: null,
      view: initialSavedView ?? { kind: "bottom" },
    });
    const lastMarkedPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(
      null
    );
    const postIdsRef = useRef(postIds);
    const backStackRef = useRef(backStack);
    const isAtBottomRef = useRef(isAtBottom);

    postIdsRef.current = postIds;
    backStackRef.current = backStack;
    isAtBottomRef.current = isAtBottom;

    /*
     * The jump highlight needs one restartable timer owned by the transcript,
     * not per-row state. Mantine's `useTimeout` gives a tiny `start/clear`
     * interface for that without adding another effect-driven state machine.
     *
     * References:
     * - https://mantine.dev/hooks/use-timeout/
     * - node_modules/.pnpm/@mantine+hooks@9.0.2_react@19.2.5/node_modules/@mantine/hooks/cjs/use-timeout/use-timeout.cjs
     */
    const { clear: clearHighlightTimeout, start: startHighlightTimeout } =
      useTimeout(clearHighlightedPost, 5000);

    /** Keeps jump-bar visibility derived from real scroll container geometry. */
    const syncViewport = useCallback(() => {
      const root = scrollRootRef.current;

      if (!root) {
        return;
      }

      updateViewport({
        hasOverflow:
          root.scrollHeight - root.clientHeight > FORUM_BOTTOM_THRESHOLD,
        isAtBottom:
          getConversationBottomDistance(root) <= FORUM_BOTTOM_THRESHOLD,
      });
    }, [updateViewport]);

    /** Clears pending placement once the semantic target is settled in place. */
    const clearReachedPendingPlacement = useCallback(() => {
      const pendingPlacement = pendingPlacementRef.current;
      const root = scrollRootRef.current;

      if (!(pendingPlacement && root)) {
        return;
      }

      const hasReachedPendingPlacement =
        pendingPlacement.view.kind === "post"
          ? hasConversationViewSettledPlacement({
              root,
              view: pendingPlacement.view,
            })
          : hasConversationViewReached({ root, view: pendingPlacement.view });

      if (!hasReachedPendingPlacement) {
        return;
      }

      if (pendingPlacement.highlightPostId) {
        clearHighlightTimeout();
        highlightPost(pendingPlacement.highlightPostId);
        startHighlightTimeout();
      }

      pendingPlacementRef.current = null;
    }, [clearHighlightTimeout, highlightPost, startHighlightTimeout]);

    /**
     * Persists only settled semantic transcript state.
     *
     * References:
     * - https://mantine.dev/hooks/use-debounced-callback/
     * - https://react.dev/learn/you-might-not-need-an-effect
     */
    const persistSettledState = useDebouncedCallback(() => {
      const root = scrollRootRef.current;

      if (!root) {
        return;
      }

      const view = captureConversationView({
        postIds: postIdsRef.current,
        root,
      });

      setSettledView(view);

      if (view) {
        saveConversationView(forumId, view);
      }

      clearReachedPendingPlacement();

      const lastVisiblePostId = getLastVisibleConversationPostId({
        postIds: postIdsRef.current,
        root,
      });

      if (
        lastVisiblePostId &&
        lastMarkedPostIdRef.current !== lastVisiblePostId
      ) {
        lastMarkedPostIdRef.current = lastVisiblePostId;
        markForumRead({
          forumId,
          lastReadPostId: lastVisiblePostId,
        }).catch(() => {
          lastMarkedPostIdRef.current = null;
        });
      }

      const backView = backStackRef.current.at(-1);

      if (backView && hasConversationViewReached({ root, view: backView })) {
        popBackView();
      }
    }, 160);

    /** Scrolls the real DOM transcript to one semantic target. */
    const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
      const root = scrollRootRef.current;

      if (!root) {
        return false;
      }

      root.scrollTo({
        behavior,
        top: root.scrollHeight,
      });
      return true;
    }, []);

    /** Scrolls the real DOM transcript to one semantic target. */
    const scrollToView = useCallback(
      ({ behavior, view }: PendingPlacement) => {
        if (view.kind === "bottom") {
          return scrollToBottom(behavior);
        }

        const root = scrollRootRef.current;

        if (!root) {
          return false;
        }

        const node = root.querySelector<HTMLElement>(
          `[data-post-id="${view.postId}"]`
        );

        if (!node) {
          return false;
        }

        node.scrollIntoView({
          behavior,
          block: "center",
          inline: "nearest",
        });
        return true;
      },
      [scrollToBottom]
    );

    /**
     * Retries semantic placement when the target row appears or content resizes.
     *
     * Follow-up retries downgrade to `auto` so repeated image/content resizes do
     * not restart a smooth scroll animation on every observer callback.
     */
    const flushPendingPlacement = useCallback(() => {
      const pendingPlacement = pendingPlacementRef.current;

      if (!pendingPlacement) {
        return;
      }

      if (
        pendingPlacement.view.kind === "post" &&
        !postIdsRef.current.includes(pendingPlacement.view.postId)
      ) {
        pendingPlacementRef.current = {
          behavior: "auto",
          highlightPostId: null,
          view: { kind: "bottom" },
        };
      }

      const nextPlacement = pendingPlacementRef.current;

      if (!(nextPlacement && scrollToView(nextPlacement))) {
        return;
      }

      pendingPlacementRef.current = {
        ...nextPlacement,
        behavior: "auto",
      };
      syncViewport();
      clearReachedPendingPlacement();
      persistSettledState();
    }, [
      clearReachedPendingPlacement,
      persistSettledState,
      scrollToView,
      syncViewport,
    ]);

    /** Maintains pinned-to-bottom behavior when live content expands. */
    const handleContentResize = useCallback(() => {
      const root = scrollRootRef.current;

      if (!root) {
        return;
      }

      if (pendingPlacementRef.current) {
        flushPendingPlacement();
      } else if (isAtBottomRef.current) {
        scrollToBottom("auto");
      }

      syncViewport();
      clearReachedPendingPlacement();
      persistSettledState();
    }, [
      clearReachedPendingPlacement,
      flushPendingPlacement,
      persistSettledState,
      scrollToBottom,
      syncViewport,
    ]);

    const getScrollBehavior = useCallback(
      () => (prefersReducedMotion ? "auto" : "smooth"),
      [prefersReducedMotion]
    );

    /**
     * Jumping to a post stays purely client-side now because every transcript
     * row already exists in one reactive Convex result array.
     */
    const goToPost = useCallback(
      (postId: Id<"schoolClassForumPosts">) => {
        const root = scrollRootRef.current;

        if (!(root && postIdsRef.current.includes(postId))) {
          return;
        }

        const targetView = { kind: "post", postId } satisfies ConversationView;
        clearHighlightTimeout();
        clearHighlightedPost();

        if (hasConversationViewSettledPlacement({ root, view: targetView })) {
          highlightPost(postId);
          startHighlightTimeout();
          return;
        }

        const currentView = captureConversationView({
          postIds: postIdsRef.current,
          root,
        });

        if (currentView && !isConversationViewAtPost(currentView, postId)) {
          pushBackView(currentView);
        }

        pendingPlacementRef.current = {
          behavior: getScrollBehavior(),
          highlightPostId: postId,
          view: targetView,
        };
        flushPendingPlacement();
      },
      [
        clearHighlightedPost,
        clearHighlightTimeout,
        flushPendingPlacement,
        getScrollBehavior,
        highlightPost,
        pushBackView,
        startHighlightTimeout,
      ]
    );

    /** Latest is just the real end of the DOM transcript, not a mode switch. */
    const goToLatest = useCallback(() => {
      pendingPlacementRef.current = {
        behavior: getScrollBehavior(),
        highlightPostId: null,
        view: { kind: "bottom" },
      };
      clearHighlightTimeout();
      clearHighlightedPost();
      flushPendingPlacement();
    }, [
      clearHighlightedPost,
      clearHighlightTimeout,
      flushPendingPlacement,
      getScrollBehavior,
    ]);

    /** Back restores the saved semantic origin instead of raw scrollTop pixels. */
    const goBack = useCallback(() => {
      const backView = popBackView();

      if (!backView) {
        return;
      }

      if (
        backView.kind === "post" &&
        !postIdsRef.current.includes(backView.postId)
      ) {
        goToLatest();
        return;
      }

      pendingPlacementRef.current = {
        behavior: getScrollBehavior(),
        highlightPostId: null,
        view: backView,
      };
      clearHighlightTimeout();
      clearHighlightedPost();
      flushPendingPlacement();
    }, [
      clearHighlightedPost,
      clearHighlightTimeout,
      flushPendingPlacement,
      getScrollBehavior,
      goToLatest,
      popBackView,
    ]);

    /** Reconnects one ResizeObserver without mirroring DOM refs into React state. */
    const handleContentRef = useCallback(
      (node: HTMLDivElement | null) => {
        contentObserverRef.current?.disconnect();
        contentObserverRef.current = null;

        if (!node) {
          return;
        }

        const observer = new ResizeObserver(handleContentResize);

        contentObserverRef.current = observer;
        observer.observe(node);
        requestAnimationFrame(handleContentResize);
      },
      [handleContentResize]
    );

    /** Registers transcript controls and boots the initial semantic restore. */
    const handleScrollRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (scrollRootRef.current === node) {
          return;
        }

        scrollRootRef.current = node;

        if (!node) {
          contentObserverRef.current?.disconnect();
          contentObserverRef.current = null;
          return;
        }

        registerControls({
          acknowledgeUnreadCue,
          goToLatest,
          goToPost,
        });
        syncViewport();
        requestAnimationFrame(flushPendingPlacement);
        requestAnimationFrame(persistSettledState);
      },
      [
        acknowledgeUnreadCue,
        flushPendingPlacement,
        goToLatest,
        goToPost,
        persistSettledState,
        registerControls,
        syncViewport,
      ]
    );

    const handleScroll = useCallback(() => {
      syncViewport();
      clearReachedPendingPlacement();
      persistSettledState();
    }, [clearReachedPendingPlacement, persistSettledState, syncViewport]);

    if (isError) {
      throw error;
    }

    if (isPending) {
      return null;
    }

    return (
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 overflow-y-auto overscroll-contain"
          onScroll={handleScroll}
          ref={handleScrollRootRef}
        >
          <div className="min-h-full" ref={handleContentRef}>
            {rows.map((row, index) => (
              <TranscriptRow
                key={getConversationRowKey(row, forum?._id)}
                nextRow={rows[index + 1]}
                previousRow={rows[index - 1]}
                row={row}
              />
            ))}
          </div>
        </div>

        {shouldShowJumpBar ? (
          <JumpBar
            canGoBack={canGoBack}
            onBack={goBack}
            onLatest={goToLatest}
          />
        ) : null}
      </div>
    );
  }
);
HydratedTranscript.displayName = "HydratedTranscript";
