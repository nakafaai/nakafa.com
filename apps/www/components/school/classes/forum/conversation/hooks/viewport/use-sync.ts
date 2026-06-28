import { useDebouncedCallback } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useRef } from "react";
import type { VirtualizerHandle } from "virtua";
import type { ConversationScrollController } from "@/components/school/classes/forum/conversation/data/scroll/controller";
import {
  getConversationScrollIntent,
  getNextConversationBottomDetachment,
} from "@/components/school/classes/forum/conversation/data/scroll/intent";
import { getConversationViewportState } from "@/components/school/classes/forum/conversation/data/scroll/metrics";
import type { ConversationPendingPlacement } from "@/components/school/classes/forum/conversation/data/scroll/restore";
import { createConversationScrollSnapshot } from "@/components/school/classes/forum/conversation/data/scroll/snapshot";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import { getLastVisibleConversationPostId } from "@/components/school/classes/forum/conversation/data/view/visible";
import type { TranscriptPlacementState } from "@/components/school/classes/forum/conversation/hooks/scroll/use-placement";
import { useScrollSave } from "@/components/school/classes/forum/conversation/hooks/scroll/use-save";
import type { TranscriptRefs } from "@/components/school/classes/forum/conversation/hooks/transcript/use-refs";
import type { ViewportStore } from "@/components/school/classes/forum/conversation/store/viewport";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

interface ViewportSyncActions {
  clearHighlightTimeout: () => void;
  highlightPost: ViewportStore["highlightPost"];
  markLastVisiblePostRead: (postId: Id<"schoolClassForumPosts"> | null) => void;
  popBackView: ViewportStore["popBackView"];
  saveConversationScrollSnapshot: (
    forumId: Id<"schoolClassForums">,
    snapshot: ConversationScrollSnapshot
  ) => void;
  startHighlightTimeout: () => void;
  updateViewport: ViewportStore["updateViewport"];
}

/** Synchronizes transcript virtualizer state with viewport and session stores. */
export function useViewportSync({
  actions,
  activeTranscript,
  forumId,
  initialRestorableCache,
  initialSavedScrollSnapshot,
  placement,
  refs,
  scrollController,
  virtualizerHandle,
}: {
  actions: ViewportSyncActions;
  activeTranscript: ActiveTranscriptModel;
  forumId: Id<"schoolClassForums">;
  initialRestorableCache: ConversationScrollSnapshot["cache"] | null;
  initialSavedScrollSnapshot: ConversationScrollSnapshot | null;
  placement: TranscriptPlacementState;
  refs: TranscriptRefs;
  scrollController: ConversationScrollController;
  virtualizerHandle: VirtualizerHandle | null;
}) {
  const isDetachedFromBottomRef = useRef(false);
  const lastScrollCacheRef = useRef(initialRestorableCache);
  const lastScrollOffsetRef = useRef(initialSavedScrollSnapshot?.offset ?? 0);
  const lastWasAtBottomRef = useRef(
    initialSavedScrollSnapshot?.wasAtBottom ?? false
  );

  const syncViewport = ({
    scrollIntent = "none",
  }: {
    scrollIntent?: ReturnType<typeof getConversationScrollIntent>;
  } = {}) => {
    const handle = virtualizerHandle;

    if (!handle) {
      return;
    }

    const measuredViewport = getConversationViewportState(handle);

    if (!measuredViewport) {
      return;
    }

    isDetachedFromBottomRef.current = getNextConversationBottomDetachment({
      isAtBottom: measuredViewport.isAtBottom,
      isDetachedFromBottom: isDetachedFromBottomRef.current,
      scrollIntent,
    });

    const viewport = getConversationViewportState(handle, {
      isDetachedFromBottom: isDetachedFromBottomRef.current,
    });

    if (!viewport) {
      return;
    }

    lastWasAtBottomRef.current = viewport.isAtBottom;
    lastScrollOffsetRef.current = handle.scrollOffset;

    actions.updateViewport(viewport);
  };

  const clearReachedPendingPlacement = () => {
    const pendingPlacement = placement.pendingPlacementRef.current;

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
      actions.clearHighlightTimeout();
      actions.highlightPost(pendingPlacement.highlightPostId);
      actions.startHighlightTimeout();
    }

    placement.setPendingPlacement(null);
  };

  const persistCurrentScrollSnapshot = () => {
    const handle = virtualizerHandle;
    const viewport = handle
      ? getConversationViewportState(handle, {
          isDetachedFromBottom: isDetachedFromBottomRef.current,
        })
      : null;
    const cache =
      handle && viewport ? handle.cache : lastScrollCacheRef.current;
    const offset =
      handle && viewport ? handle.scrollOffset : lastScrollOffsetRef.current;
    const isAtBottomFromHandle =
      viewport?.isAtBottom ?? lastWasAtBottomRef.current;
    const isAtBottom =
      placement.pendingPlacementRef.current?.view.kind === "bottom" ||
      isAtBottomFromHandle;

    lastScrollCacheRef.current = cache;
    lastScrollOffsetRef.current = offset;
    lastWasAtBottomRef.current = isAtBottom;

    actions.saveConversationScrollSnapshot(
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

  useScrollSave(persistCurrentScrollSnapshot);

  const persistSettledState = useDebouncedCallback(
    () => {
      const handle = virtualizerHandle;

      if (!handle) {
        return;
      }

      clearReachedPendingPlacement();
      actions.markLastVisiblePostRead(
        getLastVisibleConversationPostId({
          handle,
          rows: refs.rowsRef.current,
        })
      );

      const backView = refs.backStackRef.current.at(-1);

      if (backView && scrollController.isViewReached(backView)) {
        actions.popBackView();
      }

      persistCurrentScrollSnapshot();
    },
    { delay: 160, flushOnUnmount: true }
  );

  const scrollToPendingPlacement = ({
    align,
    behavior,
    view,
  }: ConversationPendingPlacement) => {
    if (view.kind === "bottom") {
      return scrollController.scrollToLatest({ behavior });
    }

    return scrollController.scrollToPost(view.postId, { align, behavior });
  };

  const flushPendingPlacement = () => {
    const pendingPlacement = placement.pendingPlacementRef.current;

    if (!pendingPlacement) {
      return;
    }

    if (
      pendingPlacement.view.kind === "post" &&
      !refs.postIdsRef.current.includes(pendingPlacement.view.postId)
    ) {
      placement.setPendingPlacement({
        behavior: pendingPlacement.behavior,
        completion: "reached",
        highlightPostId: null,
        view: { kind: "bottom" },
      });
    }

    const nextPlacement = placement.pendingPlacementRef.current;

    if (!(nextPlacement && scrollToPendingPlacement(nextPlacement))) {
      return;
    }

    syncViewport();
    clearReachedPendingPlacement();
    persistSettledState();
  };

  const handleScroll = (scrollOffset: number) => {
    syncViewport({
      scrollIntent: getConversationScrollIntent({
        currentOffset: scrollOffset,
        previousOffset: lastScrollOffsetRef.current,
      }),
    });
    clearReachedPendingPlacement();
    persistSettledState();
  };

  return {
    flushPendingPlacement,
    handleScroll,
    lastWasAtBottomRef,
    persistSettledState,
    syncViewport,
  };
}
