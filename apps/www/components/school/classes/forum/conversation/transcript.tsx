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
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Virtualizer, type VirtualizerHandle } from "virtua";
import { useControls } from "@/components/school/classes/forum/conversation/context/use-controls";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { useSession } from "@/components/school/classes/forum/conversation/context/use-session";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";
import { useActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/active-transcript";
import {
  FORUM_BOTTOM_THRESHOLD,
  getConversationRowKey,
} from "@/components/school/classes/forum/conversation/data/pages";
import {
  getConversationBottomDistance,
  getLastVisibleConversationPostId,
} from "@/components/school/classes/forum/conversation/data/settled-view";
import { createConversationScrollController } from "@/components/school/classes/forum/conversation/data/transcript-scroll";
import { useConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/unread";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";
import { isConversationViewAtPost } from "@/components/school/classes/forum/conversation/data/view";
import { JumpBar } from "@/components/school/classes/forum/conversation/jump-bar";
import { VirtualTranscriptRow } from "@/components/school/classes/forum/conversation/transcript-row";

interface PendingPlacement {
  behavior?: ScrollBehavior;
  highlightPostId: Id<"schoolClassForumPosts"> | null;
  view: ConversationView;
}

/**
 * Virtua transcript backed by one reactive Convex query.
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
    const activeTranscript = useActiveTranscriptModel({
      forum,
      posts: transcriptPosts,
      unreadCue,
    });
    const canGoBack = backStack.length > 0;
    const scrollRootRef = useRef<HTMLDivElement | null>(null);
    const virtualizerRef = useRef<VirtualizerHandle | null>(null);
    const pendingPlacementRef = useRef<PendingPlacement | null>({
      behavior: "auto",
      highlightPostId: null,
      view: initialSavedView ?? { kind: "bottom" },
    });
    const [isPendingLatestPlacement, setIsPendingLatestPlacement] = useState(
      pendingPlacementRef.current?.view.kind === "bottom"
    );
    const lastMarkedPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(
      null
    );
    const postIdsRef = useRef(activeTranscript.postIds);
    const backStackRef = useRef(backStack);
    const isAtBottomRef = useRef(isAtBottom);

    postIdsRef.current = activeTranscript.postIds;
    backStackRef.current = backStack;
    isAtBottomRef.current = isAtBottom;

    const shouldShowJumpBar =
      hasOverflow && (canGoBack || !(isAtBottom || isPendingLatestPlacement));

    const setPendingPlacement = useCallback(
      (placement: PendingPlacement | null) => {
        pendingPlacementRef.current = placement;
        setIsPendingLatestPlacement(placement?.view.kind === "bottom");
      },
      []
    );

    const scrollController = useMemo(
      () =>
        createConversationScrollController({
          lastRowIndex: activeTranscript.lastRowIndex,
          postIds: activeTranscript.postIds,
          prefersReducedMotion,
          rowIndexByPostId: activeTranscript.rowIndexByPostId,
          scrollRootRef,
          virtualizerRef,
        }),
      [
        activeTranscript.lastRowIndex,
        activeTranscript.postIds,
        activeTranscript.rowIndexByPostId,
        prefersReducedMotion,
      ]
    );

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
          ? scrollController.isViewSettled(pendingPlacement.view)
          : scrollController.isViewReached(pendingPlacement.view);

      if (!hasReachedPendingPlacement) {
        return;
      }

      if (pendingPlacement.highlightPostId) {
        clearHighlightTimeout();
        highlightPost(pendingPlacement.highlightPostId);
        startHighlightTimeout();
      }

      setPendingPlacement(null);
    }, [
      clearHighlightTimeout,
      highlightPost,
      setPendingPlacement,
      scrollController,
      startHighlightTimeout,
    ]);

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

      const view = scrollController.captureView();

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

      if (backView && scrollController.isViewReached(backView)) {
        popBackView();
      }
    }, 160);

    const scrollToPendingPlacement = useCallback(
      ({ behavior, view }: PendingPlacement) => {
        if (view.kind === "bottom") {
          return scrollController.scrollToLatest({ behavior });
        }

        return scrollController.scrollToPost(view.postId, { behavior });
      },
      [scrollController]
    );

    /** Retries semantic placement when the target row appears or content resizes. */
    const flushPendingPlacement = useCallback(() => {
      const pendingPlacement = pendingPlacementRef.current;

      if (!pendingPlacement) {
        return;
      }

      if (
        pendingPlacement.view.kind === "post" &&
        !postIdsRef.current.includes(pendingPlacement.view.postId)
      ) {
        setPendingPlacement({
          behavior: pendingPlacement.behavior,
          highlightPostId: null,
          view: { kind: "bottom" },
        });
      }

      const nextPlacement = pendingPlacementRef.current;

      if (!(nextPlacement && scrollToPendingPlacement(nextPlacement))) {
        return;
      }

      syncViewport();
      clearReachedPendingPlacement();
      persistSettledState();
    }, [
      clearReachedPendingPlacement,
      persistSettledState,
      setPendingPlacement,
      scrollToPendingPlacement,
      syncViewport,
    ]);

    /**
     * Jumping to a post stays purely client-side now because every transcript
     * row already exists in one reactive Convex result array.
     */
    const goToPost = useCallback(
      (postId: Id<"schoolClassForumPosts">) => {
        const root = scrollRootRef.current;

        if (!(root && activeTranscript.rowIndexByPostId.has(postId))) {
          return;
        }

        const targetView = { kind: "post", postId } satisfies ConversationView;
        clearHighlightTimeout();
        clearHighlightedPost();

        if (scrollController.isViewSettled(targetView)) {
          highlightPost(postId);
          startHighlightTimeout();
          return;
        }

        const currentView = scrollController.captureView();

        if (currentView && !isConversationViewAtPost(currentView, postId)) {
          pushBackView(currentView);
        }

        setPendingPlacement({
          behavior: "smooth",
          highlightPostId: postId,
          view: targetView,
        });
        flushPendingPlacement();
      },
      [
        activeTranscript.rowIndexByPostId,
        clearHighlightedPost,
        clearHighlightTimeout,
        flushPendingPlacement,
        highlightPost,
        pushBackView,
        setPendingPlacement,
        scrollController,
        startHighlightTimeout,
      ]
    );

    /** Latest is just the real end of the DOM transcript, not a mode switch. */
    const goToLatest = useCallback(() => {
      setPendingPlacement({
        behavior: "smooth",
        highlightPostId: null,
        view: { kind: "bottom" },
      });
      clearHighlightTimeout();
      clearHighlightedPost();
      flushPendingPlacement();
    }, [
      clearHighlightedPost,
      clearHighlightTimeout,
      flushPendingPlacement,
      setPendingPlacement,
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

      setPendingPlacement({
        behavior: "smooth",
        highlightPostId: null,
        view: backView,
      });
      clearHighlightTimeout();
      clearHighlightedPost();
      flushPendingPlacement();
    }, [
      clearHighlightedPost,
      clearHighlightTimeout,
      flushPendingPlacement,
      goToLatest,
      popBackView,
      setPendingPlacement,
    ]);

    /** Registers transcript controls and boots the initial semantic restore. */
    const handleScrollRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (scrollRootRef.current === node) {
          return;
        }

        scrollRootRef.current = node;

        if (!node) {
          return;
        }

        registerControls({
          acknowledgeUnreadCue,
          goToLatest,
          goToPost,
        });
        syncViewport();
      },
      [
        acknowledgeUnreadCue,
        goToLatest,
        goToPost,
        registerControls,
        syncViewport,
      ]
    );

    const handleScroll = useCallback(() => {
      syncViewport();
      clearReachedPendingPlacement();
      persistSettledState();
    }, [clearReachedPendingPlacement, persistSettledState, syncViewport]);

    useLayoutEffect(() => {
      const frameId = requestAnimationFrame(() => {
        syncViewport();

        if (pendingPlacementRef.current) {
          flushPendingPlacement();
        } else if (isAtBottomRef.current) {
          scrollController.scrollToLatest();
          syncViewport();
        }

        persistSettledState();
      });

      return () => {
        cancelAnimationFrame(frameId);
      };
    }, [
      flushPendingPlacement,
      persistSettledState,
      scrollController,
      syncViewport,
    ]);

    if (isError) {
      throw error;
    }

    if (isPending) {
      return null;
    }

    return (
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 flex flex-col overflow-y-auto overscroll-contain"
          onScroll={handleScroll}
          ref={handleScrollRootRef}
          style={{ overflowAnchor: "none" }}
        >
          <div className="grow" />
          <Virtualizer
            data={activeTranscript.rows}
            ref={virtualizerRef}
            scrollRef={scrollRootRef}
          >
            {(row, index) => (
              <VirtualTranscriptRow
                index={index}
                key={getConversationRowKey(row, forum?._id)}
                row={row}
                rows={activeTranscript.rows}
              />
            )}
          </Virtualizer>
        </div>

        <JumpBar
          canGoBack={canGoBack}
          onBack={goBack}
          onLatest={goToLatest}
          visible={shouldShowJumpBar}
        />
      </div>
    );
  }
);
HydratedTranscript.displayName = "HydratedTranscript";
