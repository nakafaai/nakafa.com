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
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ScrollToIndexOpts,
  Virtualizer,
  type VirtualizerHandle,
} from "virtua";
import { useControls } from "@/components/school/classes/forum/conversation/context/use-controls";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import {
  useSession,
  useSessionStoreApi,
} from "@/components/school/classes/forum/conversation/context/use-session";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";
import {
  FORUM_BOTTOM_THRESHOLD,
  getConversationRowKey,
} from "@/components/school/classes/forum/conversation/data/pages";
import {
  createConversationScrollSnapshot,
  getInitialConversationRestoreTarget,
} from "@/components/school/classes/forum/conversation/data/scroll-snapshot";
import {
  getConversationBottomDistance,
  getLastVisibleConversationPostId,
} from "@/components/school/classes/forum/conversation/data/settled-view";
import { createConversationScrollController } from "@/components/school/classes/forum/conversation/data/transcript-scroll";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";
import { isConversationViewAtPost } from "@/components/school/classes/forum/conversation/data/view";
import { useActiveTranscriptModel } from "@/components/school/classes/forum/conversation/hooks/use-active-transcript-model";
import { useConversationUnreadCue } from "@/components/school/classes/forum/conversation/hooks/use-conversation-unread-cue";
import { JumpBar } from "@/components/school/classes/forum/conversation/jump-bar";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/conversation/store/session";
import { canRestoreConversationScrollCache } from "@/components/school/classes/forum/conversation/store/session";
import { VirtualTranscriptRow } from "@/components/school/classes/forum/conversation/transcript-row";

type PendingPlacementAlign = NonNullable<ScrollToIndexOpts["align"]>;

interface PendingPlacement {
  align?: PendingPlacementAlign;
  behavior?: ScrollBehavior;
  completion: "reached" | "settled";
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
 * - virtua advanced chat story:
 *   https://github.com/inokawa/virtua/blob/main/stories/react/advanced/Chat.stories.tsx
 */
export const ForumConversationTranscript = memo(() => {
  const forumId = useData((state) => state.forumId);
  const isHydrated = useSession((state) => state.isHydrated);
  const sessionStore = useSessionStoreApi();

  const savedScrollSnapshot =
    sessionStore.getState().savedConversationScrollSnapshots[forumId] ?? null;

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
      initialSavedScrollSnapshot={savedScrollSnapshot}
      key={forumId}
    />
  );
});
ForumConversationTranscript.displayName = "ForumConversationTranscript";

/** Owns the stateful virtual transcript for one hydrated forum session. */
const HydratedTranscript = memo(
  ({
    forumId,
    initialSavedScrollSnapshot,
  }: {
    forumId: Id<"schoolClassForums">;
    initialSavedScrollSnapshot: ConversationScrollSnapshot | null;
  }) => {
    const forum = useData((state) => state.forum);
    const saveConversationScrollSnapshot = useSession(
      (state) => state.saveConversationScrollSnapshot
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
    const canRestoreInitialCache = canRestoreConversationScrollCache({
      lastPostId: activeTranscript.lastPostId,
      renderedRowCount: activeTranscript.rows.length,
      snapshot: initialSavedScrollSnapshot,
    });
    const initialRestorableCache = canRestoreInitialCache
      ? (initialSavedScrollSnapshot?.cache ?? null)
      : null;
    const canGoBack = backStack.length > 0;
    const virtualizerRef = useRef<VirtualizerHandle | null>(null);
    const pendingPlacementRef = useRef<PendingPlacement | null>(null);
    const pendingScrollOffsetRef = useRef<number | null>(null);
    const hasBootstrappedRestoreRef = useRef(false);
    const [isPendingLatestPlacement, setIsPendingLatestPlacement] =
      useState(false);
    const lastScrollCacheRef = useRef(initialRestorableCache);
    const lastScrollOffsetRef = useRef(initialSavedScrollSnapshot?.offset ?? 0);
    const lastWasAtBottomRef = useRef(
      initialSavedScrollSnapshot?.wasAtBottom ?? false
    );
    const lastMarkedPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(
      null
    );
    const postIdsRef = useRef(activeTranscript.postIds);
    const backStackRef = useRef(backStack);
    const rowsRef = useRef(activeTranscript.rows);
    const persistCurrentScrollSnapshotRef = useRef<(() => void) | null>(null);

    postIdsRef.current = activeTranscript.postIds;
    backStackRef.current = backStack;
    rowsRef.current = activeTranscript.rows;

    if (!(hasBootstrappedRestoreRef.current || isPending)) {
      const initialRestoreTarget = getInitialConversationRestoreTarget({
        savedScrollSnapshot: initialSavedScrollSnapshot,
        unreadCue,
      });

      if (initialRestoreTarget.kind === "offset") {
        pendingScrollOffsetRef.current = initialRestoreTarget.offset;
      } else if (initialRestoreTarget.kind === "post") {
        pendingPlacementRef.current = {
          align: initialRestoreTarget.align,
          behavior: "auto",
          completion: "reached",
          highlightPostId: null,
          view: {
            kind: "post",
            postId: initialRestoreTarget.postId,
          },
        };
      } else {
        pendingPlacementRef.current = {
          behavior: "auto",
          completion: "reached",
          highlightPostId: null,
          view: { kind: "bottom" },
        };
      }

      hasBootstrappedRestoreRef.current = true;
    }

    const hasPendingLatestPlacement =
      isPendingLatestPlacement ||
      pendingPlacementRef.current?.view.kind === "bottom";

    const shouldShowJumpBar =
      hasOverflow && (canGoBack || !(isAtBottom || hasPendingLatestPlacement));

    /** Stores pending semantic placement and mirrors latest placement into UI state. */
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
          prefersReducedMotion,
          rowIndexByPostId: activeTranscript.rowIndexByPostId,
          rows: activeTranscript.rows,
          virtualizerRef,
        }),
      [
        activeTranscript.rowIndexByPostId,
        activeTranscript.rows,
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

    /** Keeps jump-bar visibility derived from the active virtualizer metrics. */
    const syncViewport = useCallback(() => {
      const handle = virtualizerRef.current;

      if (!handle) {
        return;
      }

      const bottomDistance = getConversationBottomDistance(handle);
      const isAtBottom = bottomDistance <= FORUM_BOTTOM_THRESHOLD;

      lastWasAtBottomRef.current = isAtBottom;
      lastScrollOffsetRef.current = handle.scrollOffset;

      updateViewport({
        hasOverflow:
          handle.scrollSize - handle.viewportSize > FORUM_BOTTOM_THRESHOLD,
        isAtBottom,
      });
    }, [updateViewport]);

    /** Clears pending placement once the semantic target is settled in place. */
    const clearReachedPendingPlacement = useCallback(() => {
      const pendingPlacement = pendingPlacementRef.current;

      if (!pendingPlacement) {
        return;
      }

      const hasReachedPendingPlacement =
        pendingPlacement.completion === "settled"
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
     * Debounces transcript side effects that should only run on settled scroll.
     *
     * References:
     * - https://mantine.dev/hooks/use-debounced-callback/
     * - https://react.dev/learn/you-might-not-need-an-effect
     */
    const persistSettledState = useDebouncedCallback(
      () => {
        const handle = virtualizerRef.current;

        if (!handle) {
          return;
        }

        clearReachedPendingPlacement();

        const lastVisiblePostId = getLastVisibleConversationPostId({
          handle,
          rows: rowsRef.current,
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

        persistCurrentScrollSnapshotRef.current?.();
      },
      { delay: 160, flushOnUnmount: true }
    );

    /** Captures a restorable scroll snapshot from current or last known metrics. */
    persistCurrentScrollSnapshotRef.current = () => {
      const handle = virtualizerRef.current;
      const cache = handle?.cache ?? lastScrollCacheRef.current;
      const offset = handle?.scrollOffset ?? lastScrollOffsetRef.current;
      const isAtBottomFromHandle = handle
        ? getConversationBottomDistance(handle) <= FORUM_BOTTOM_THRESHOLD
        : lastWasAtBottomRef.current;
      const isAtBottom =
        pendingPlacementRef.current?.view.kind === "bottom" ||
        isAtBottomFromHandle;

      lastScrollCacheRef.current = cache;
      lastScrollOffsetRef.current = offset;
      lastWasAtBottomRef.current = isAtBottom;

      saveConversationScrollSnapshot(
        forumId,
        createConversationScrollSnapshot({
          cache,
          isAtBottom,
          lastPostId: activeTranscript.lastPostId,
          offset,
          renderedRowCount: activeTranscript.rows.length,
        })
      );
    };

    /** Sends one pending semantic placement to the active scroll controller. */
    const scrollToPendingPlacement = useCallback(
      ({ align, behavior, view }: PendingPlacement) => {
        if (view.kind === "bottom") {
          return scrollController.scrollToLatest({ behavior });
        }

        return scrollController.scrollToPost(view.postId, { align, behavior });
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
          completion: "reached",
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
        if (!activeTranscript.rowIndexByPostId.has(postId)) {
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
          align: "center",
          behavior: "smooth",
          completion: "settled",
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

    /** Latest is just the real end of the transcript, not a mode switch. */
    const goToLatest = useCallback(() => {
      setPendingPlacement({
        behavior: "smooth",
        completion: "reached",
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

    /** Back restores the saved semantic origin instead of raw offset pixels. */
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

      if (backView.kind === "bottom") {
        setPendingPlacement({
          behavior: "smooth",
          completion: "reached",
          highlightPostId: null,
          view: backView,
        });
      } else {
        setPendingPlacement({
          align: "center",
          behavior: "smooth",
          completion: "settled",
          highlightPostId: null,
          view: backView,
        });
      }
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

    /** Synchronizes viewport state after Virtua reports scroll movement. */
    const handleScroll = useCallback(() => {
      syncViewport();
      clearReachedPendingPlacement();
      persistSettledState();
    }, [clearReachedPendingPlacement, persistSettledState, syncViewport]);

    useEffect(() => {
      registerControls({
        acknowledgeUnreadCue,
        goToLatest,
        goToPost,
      });
    }, [acknowledgeUnreadCue, goToLatest, goToPost, registerControls]);

    useEffect(() => {
      /** Saves the latest snapshot before the browser hides or unloads the page. */
      const saveCurrentScrollSnapshot = () => {
        persistCurrentScrollSnapshotRef.current?.();
      };

      /** Handles browsers that fire visibility before page lifecycle unload. */
      const handleVisibilityChange = () => {
        if (document.visibilityState !== "hidden") {
          return;
        }

        saveCurrentScrollSnapshot();
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("pagehide", saveCurrentScrollSnapshot);

      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
        window.removeEventListener("pagehide", saveCurrentScrollSnapshot);
      };
    }, []);

    useLayoutEffect(() => {
      const frameId = requestAnimationFrame(() => {
        const shouldStickToBottom =
          lastWasAtBottomRef.current &&
          !pendingPlacementRef.current &&
          pendingScrollOffsetRef.current === null;

        if (shouldStickToBottom) {
          setPendingPlacement({
            behavior: "smooth",
            completion: "reached",
            highlightPostId: null,
            view: { kind: "bottom" },
          });
        }

        syncViewport();

        if (pendingPlacementRef.current?.view.kind === "bottom") {
          flushPendingPlacement();
        } else if (pendingScrollOffsetRef.current !== null) {
          virtualizerRef.current?.scrollTo(pendingScrollOffsetRef.current);
          pendingScrollOffsetRef.current = null;
          syncViewport();
        } else if (pendingPlacementRef.current) {
          flushPendingPlacement();
        }

        persistSettledState();
      });

      return () => {
        cancelAnimationFrame(frameId);
      };
    }, [
      flushPendingPlacement,
      persistSettledState,
      setPendingPlacement,
      syncViewport,
    ]);

    useLayoutEffect(
      () => () => {
        if (persistSettledState.isPending()) {
          return;
        }

        persistCurrentScrollSnapshotRef.current?.();
      },
      [persistSettledState]
    );

    if (isError) {
      throw error;
    }

    if (isPending) {
      return null;
    }

    return (
      <>
        <div
          className="absolute inset-0 flex flex-col overflow-y-auto overscroll-contain"
          style={{ overflowAnchor: "none" }}
        >
          <div className="grow" />
          <Virtualizer
            cache={initialRestorableCache ?? undefined}
            data={activeTranscript.rows}
            onScroll={handleScroll}
            ref={virtualizerRef}
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
      </>
    );
  }
);
HydratedTranscript.displayName = "HydratedTranscript";
