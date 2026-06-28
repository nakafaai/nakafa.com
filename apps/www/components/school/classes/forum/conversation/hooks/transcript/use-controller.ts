import { useReducedMotion, useTimeout } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useEffect, useLayoutEffect, useState } from "react";
import type { VirtualizerHandle } from "virtua";
import { useForumSession } from "@/components/school/classes/forum/context/use-session";
import { useControls } from "@/components/school/classes/forum/conversation/context/use-controls";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";
import { createConversationScrollController } from "@/components/school/classes/forum/conversation/data/scroll/controller";
import { useReadSync } from "@/components/school/classes/forum/conversation/hooks/read/use-sync";
import { useRestoreState } from "@/components/school/classes/forum/conversation/hooks/restore/use-state";
import { usePlacement } from "@/components/school/classes/forum/conversation/hooks/scroll/use-placement";
import { useTranscriptActions } from "@/components/school/classes/forum/conversation/hooks/transcript/use-actions";
import { useTranscriptData } from "@/components/school/classes/forum/conversation/hooks/transcript/use-data";
import { useTranscriptRefs } from "@/components/school/classes/forum/conversation/hooks/transcript/use-refs";
import { useViewportSync } from "@/components/school/classes/forum/conversation/hooks/viewport/use-sync";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

/** Owns the stateful virtual transcript controls for one hydrated forum. */
export function useHydratedTranscriptController({
  forumId,
  initialSavedScrollSnapshot,
}: {
  forumId: Id<"schoolClassForums">;
  initialSavedScrollSnapshot: ConversationScrollSnapshot | null;
}) {
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
  const {
    acknowledgeUnreadCue,
    activeTranscript,
    error,
    forum,
    initialRestorableCache,
    isError,
    isPending,
    unreadCue,
  } = useTranscriptData({
    forumId,
    initialSavedScrollSnapshot,
  });
  const markLastVisiblePostRead = useReadSync({ forumId });

  const canGoBack = backStack.length > 0;
  const [virtualizerHandle, setVirtualizerHandle] =
    useState<VirtualizerHandle | null>(null);
  const [restoreState, setRestoreState] = useRestoreState({
    initialSavedScrollSnapshot,
    isPending,
    unreadCue,
  });
  const refs = useTranscriptRefs({
    activeTranscript,
    backStack,
  });
  const placement = usePlacement({
    restoreState,
    setRestoreState,
  });
  const shouldShowJumpBar =
    hasOverflow &&
    (canGoBack || !(isAtBottom || restoreState.isPendingLatestPlacement));

  const scrollController = createConversationScrollController({
    handle: virtualizerHandle,
    prefersReducedMotion,
    rowIndexByPostId: activeTranscript.rowIndexByPostId,
    rows: activeTranscript.rows,
  });
  const { clear: clearHighlightTimeout, start: startHighlightTimeout } =
    useTimeout(clearHighlightedPost, 5000);
  const {
    flushPendingPlacement,
    handleScroll,
    lastWasAtBottomRef,
    persistSettledState,
    syncViewport,
  } = useViewportSync({
    actions: {
      clearHighlightTimeout,
      highlightPost,
      markLastVisiblePostRead,
      popBackView,
      saveConversationScrollSnapshot,
      startHighlightTimeout,
      updateViewport,
    },
    activeTranscript,
    forumId,
    initialRestorableCache,
    initialSavedScrollSnapshot,
    placement,
    refs,
    scrollController,
    virtualizerHandle,
  });
  const { goBack, goToLatest, goToPost } = useTranscriptActions({
    activeTranscript,
    flushPendingPlacement,
    handlers: {
      clearHighlightedPost,
      clearHighlightTimeout,
      highlightPost,
      popBackView,
      pushBackView,
      startHighlightTimeout,
    },
    placement,
    refs,
    scrollController,
  });

  useEffect(() => {
    registerControls({
      acknowledgeUnreadCue,
      goToLatest,
      goToPost,
    });
  });

  useLayoutEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const shouldStickToBottom =
        lastWasAtBottomRef.current &&
        !placement.pendingPlacementRef.current &&
        placement.pendingScrollOffsetRef.current === null;

      if (shouldStickToBottom) {
        placement.setPendingPlacement({
          behavior: "smooth",
          completion: "reached",
          highlightPostId: null,
          view: { kind: "bottom" },
        });
      }

      syncViewport();

      if (placement.pendingPlacementRef.current?.view.kind === "bottom") {
        flushPendingPlacement();
      } else if (placement.pendingScrollOffsetRef.current !== null) {
        virtualizerHandle?.scrollTo(placement.pendingScrollOffsetRef.current);
        placement.pendingScrollOffsetRef.current = null;
        syncViewport();
      } else if (placement.pendingPlacementRef.current) {
        flushPendingPlacement();
      }

      persistSettledState();
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  });

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
