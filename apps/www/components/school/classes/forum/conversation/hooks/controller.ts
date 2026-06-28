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
import { Effect } from "effect";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ScrollToIndexOpts, VirtualizerHandle } from "virtua";
import { useForumSession } from "@/components/school/classes/forum/context/use-session";
import { useControls } from "@/components/school/classes/forum/conversation/context/use-controls";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";
import {
  createConversationScrollSnapshot,
  getInitialConversationRestoreTarget,
} from "@/components/school/classes/forum/conversation/data/scroll-snapshot";
import {
  getConversationViewportState,
  getLastVisibleConversationPostId,
} from "@/components/school/classes/forum/conversation/data/settled-view";
import { createConversationScrollController } from "@/components/school/classes/forum/conversation/data/transcript-scroll";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";
import { isConversationViewAtPost } from "@/components/school/classes/forum/conversation/data/view";
import { useActiveTranscriptModel } from "@/components/school/classes/forum/conversation/hooks/use-active-transcript-model";
import { useConversationUnreadCue } from "@/components/school/classes/forum/conversation/hooks/use-conversation-unread-cue";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";
import { canRestoreConversationScrollCache } from "@/components/school/classes/forum/store/session";

type PendingPlacementAlign = NonNullable<ScrollToIndexOpts["align"]>;
type InitialRestoreTarget = ReturnType<
  typeof getInitialConversationRestoreTarget
>;

interface PendingPlacement {
  align?: PendingPlacementAlign;
  behavior?: ScrollBehavior;
  completion: "reached" | "settled";
  highlightPostId: Id<"schoolClassForumPosts"> | null;
  view: ConversationView;
}

/** Owns the stateful virtual transcript controls for one hydrated forum. */
export function useHydratedTranscriptController({
  forumId,
  initialSavedScrollSnapshot,
}: {
  forumId: Id<"schoolClassForums">;
  initialSavedScrollSnapshot: ConversationScrollSnapshot | null;
}) {
  const forum = useData((state) => state.forum);
  const saveConversationScrollSnapshot = useForumSession(
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
  const [virtualizerHandle, setVirtualizerHandle] =
    useState<VirtualizerHandle | null>(null);
  const pendingPlacementRef = useRef<PendingPlacement | null>(null);
  const pendingScrollOffsetRef = useRef<number | null>(null);
  const [restoreState, setRestoreState] = useState<{
    hasBootstrapped: boolean;
    isPendingLatestPlacement: boolean;
    target: InitialRestoreTarget | null;
  }>({
    hasBootstrapped: false,
    isPendingLatestPlacement: false,
    target: null,
  });
  const lastScrollCacheRef = useRef(initialRestorableCache);
  const lastScrollOffsetRef = useRef(initialSavedScrollSnapshot?.offset ?? 0);
  const lastWasAtBottomRef = useRef(
    initialSavedScrollSnapshot?.wasAtBottom ?? false
  );
  const lastMarkedPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(null);
  const postIdsRef = useRef(activeTranscript.postIds);
  const backStackRef = useRef(backStack);
  const rowsRef = useRef(activeTranscript.rows);
  const persistCurrentScrollSnapshotRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    postIdsRef.current = activeTranscript.postIds;
    backStackRef.current = backStack;
    rowsRef.current = activeTranscript.rows;
  });

  let currentRestoreState = restoreState;

  if (!(restoreState.hasBootstrapped || isPending)) {
    const target = getInitialConversationRestoreTarget({
      savedScrollSnapshot: initialSavedScrollSnapshot,
      unreadCue,
    });
    currentRestoreState = {
      hasBootstrapped: true,
      isPendingLatestPlacement: target.kind === "bottom",
      target,
    };
    setRestoreState(currentRestoreState);
  }

  const shouldShowJumpBar =
    hasOverflow &&
    (canGoBack ||
      !(isAtBottom || currentRestoreState.isPendingLatestPlacement));

  /**
   * Records the scroll target that still needs virtualizer confirmation before
   * the conversation view can be treated as settled.
   */
  const setPendingPlacement = (placement: PendingPlacement | null) => {
    pendingPlacementRef.current = placement;
    const isPendingLatestPlacement = placement?.view.kind === "bottom";

    setRestoreState((current) => {
      if (current.isPendingLatestPlacement === isPendingLatestPlacement) {
        return current;
      }

      return {
        ...current,
        isPendingLatestPlacement,
      };
    });
  };

  useLayoutEffect(() => {
    const initialRestoreTarget = restoreState.target;

    if (!initialRestoreTarget) {
      return;
    }

    if (initialRestoreTarget.kind === "offset") {
      pendingScrollOffsetRef.current = initialRestoreTarget.offset;
      return;
    }

    if (initialRestoreTarget.kind === "post") {
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
      return;
    }

    pendingPlacementRef.current = {
      behavior: "auto",
      completion: "reached",
      highlightPostId: null,
      view: { kind: "bottom" },
    };
  }, [restoreState.target]);

  const scrollController = createConversationScrollController({
    handle: virtualizerHandle,
    prefersReducedMotion,
    rowIndexByPostId: activeTranscript.rowIndexByPostId,
    rows: activeTranscript.rows,
  });

  const { clear: clearHighlightTimeout, start: startHighlightTimeout } =
    useTimeout(clearHighlightedPost, 5000);

  /**
   * Samples the virtualizer viewport and mirrors it into controller state for
   * jump-bar visibility, restore snapshots, and bottom detection.
   */
  const syncViewport = () => {
    const handle = virtualizerHandle;

    if (!handle) {
      return;
    }

    const viewport = getConversationViewportState(handle);

    if (!viewport) {
      return;
    }

    lastWasAtBottomRef.current = viewport.isAtBottom;
    lastScrollOffsetRef.current = handle.scrollOffset;

    updateViewport(viewport);
  };

  /**
   * Clears a pending placement only after the virtualizer has reached the
   * requested post or bottom position.
   */
  const clearReachedPendingPlacement = () => {
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
  };

  const persistSettledState = useDebouncedCallback(
    () => {
      const handle = virtualizerHandle;

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
        Effect.runFork(
          Effect.tryPromise({
            try: () =>
              markForumRead({
                forumId,
                lastReadPostId: lastVisiblePostId,
              }),
            catch: (cause) => cause,
          }).pipe(
            Effect.catchAll(() =>
              Effect.sync(() => {
                lastMarkedPostIdRef.current = null;
              })
            )
          )
        );
      }

      const backView = backStackRef.current.at(-1);

      if (backView && scrollController.isViewReached(backView)) {
        popBackView();
      }

      persistCurrentScrollSnapshotRef.current?.();
    },
    { delay: 160, flushOnUnmount: true }
  );

  /**
   * Persists the current conversation viewport so route transitions can restore
   * the same scroll cache and last visible post.
   */
  const persistCurrentScrollSnapshot = () => {
    const handle = virtualizerHandle;
    const viewport = handle ? getConversationViewportState(handle) : null;
    const cache =
      handle && viewport ? handle.cache : lastScrollCacheRef.current;
    const offset =
      handle && viewport ? handle.scrollOffset : lastScrollOffsetRef.current;
    const isAtBottomFromHandle =
      viewport?.isAtBottom ?? lastWasAtBottomRef.current;
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

  useLayoutEffect(() => {
    persistCurrentScrollSnapshotRef.current = persistCurrentScrollSnapshot;
  });

  /**
   * Applies one pending placement to the virtualizer, using bottom scrolling or
   * post alignment according to the captured target view.
   */
  const scrollToPendingPlacement = ({
    align,
    behavior,
    view,
  }: PendingPlacement) => {
    if (view.kind === "bottom") {
      return scrollController.scrollToLatest({ behavior });
    }

    return scrollController.scrollToPost(view.postId, { align, behavior });
  };

  /**
   * Attempts to execute the pending placement after the transcript rows needed
   * for that target are available.
   */
  const flushPendingPlacement = () => {
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
  };

  /**
   * Navigates to one post while preserving the previous settled view for the
   * in-thread back stack.
   */
  const goToPost = (postId: Id<"schoolClassForumPosts">) => {
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
  };

  /**
   * Moves to the latest conversation row and clears any transient highlighted
   * post state.
   */
  const goToLatest = () => {
    setPendingPlacement({
      behavior: "smooth",
      completion: "reached",
      highlightPostId: null,
      view: { kind: "bottom" },
    });
    clearHighlightTimeout();
    clearHighlightedPost();
    flushPendingPlacement();
  };

  /**
   * Restores the most recent conversation view captured before a post jump.
   */
  const goBack = () => {
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
  };

  const handleScroll = () => {
    syncViewport();
    clearReachedPendingPlacement();
    persistSettledState();
  };

  useEffect(() => {
    registerControls({
      acknowledgeUnreadCue,
      goToLatest,
      goToPost,
    });
  });

  useEffect(() => {
    const saveCurrentScrollSnapshot = () => {
      persistCurrentScrollSnapshotRef.current?.();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        return;
      }

      saveCurrentScrollSnapshot();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", saveCurrentScrollSnapshot);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
        virtualizerHandle?.scrollTo(pendingScrollOffsetRef.current);
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
  });

  useLayoutEffect(
    () => () => {
      persistCurrentScrollSnapshotRef.current?.();
    },
    []
  );

  return {
    activeTranscript,
    canGoBack,
    error,
    forum,
    goBack,
    goToLatest,
    handleScroll,
    initialRestorableCache,
    isError,
    isPending,
    setVirtualizerHandle,
    shouldShowJumpBar,
  };
}
