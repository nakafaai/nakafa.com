import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import { useCallback, useEffectEvent, useRef } from "react";
import type { VirtualizerHandle } from "virtua";
import {
  isConversationPostVisibleInDom,
  reconcileConversationDomAnchor,
} from "@/components/school/classes/forum/conversation/utils/transcript";
import type { ForumConversationView } from "@/lib/store/forum";

type ScrollAlignment = "center" | "start";
type ScrollBehavior = "auto" | "smooth";
type TranscriptView = Extract<ForumConversationView, { kind: "post" }>;

interface UseTranscriptAnchorResult {
  resetAnchor: () => void;
  scrollToView: (options: {
    align: ScrollAlignment;
    behavior: ScrollBehavior;
    view: TranscriptView;
  }) => boolean;
  syncHighlightVisibility: () => void;
}

/** Owns DOM-anchor restoration and highlight visibility for one transcript root. */
export function useTranscriptAnchor({
  handleHighlightVisiblePost,
  handleRef,
  pendingHighlightPostId,
  postIdToIndex,
  scrollElementRef,
}: {
  handleHighlightVisiblePost: (postId: Id<"schoolClassForumPosts">) => void;
  handleRef: RefObject<VirtualizerHandle | null>;
  pendingHighlightPostId: Id<"schoolClassForumPosts"> | null;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}): UseTranscriptAnchorResult {
  const pendingViewAnchorRef = useRef<{
    postId: Id<"schoolClassForumPosts">;
    topWithinScrollRoot: number;
  } | null>(null);
  const reconcileAttemptRef = useRef(0);
  const reconcileFrameRef = useRef<number | null>(null);

  /** Stops the active DOM-anchor reconciliation loop and clears pending work. */
  const stopAnchorReconciliation = useCallback(() => {
    if (reconcileFrameRef.current === null) {
      return;
    }

    cancelAnimationFrame(reconcileFrameRef.current);
    reconcileAttemptRef.current = 0;
    reconcileFrameRef.current = null;
  }, []);

  /** Clears any pending DOM-anchor restoration state. */
  const resetAnchor = useCallback(() => {
    pendingViewAnchorRef.current = null;
    stopAnchorReconciliation();
  }, [stopAnchorReconciliation]);

  /** Applies one DOM-anchor correction frame until the target row settles or disappears. */
  const reconcilePendingAnchor = useCallback(() => {
    const anchor = pendingViewAnchorRef.current;
    const scrollElement = scrollElementRef.current;

    if (!(anchor && scrollElement)) {
      resetAnchor();
      return;
    }

    const status = reconcileConversationDomAnchor({
      anchor,
      scrollElement,
    });

    if (status === "settled") {
      resetAnchor();
      return;
    }

    if (status === "missing" && reconcileAttemptRef.current >= 24) {
      resetAnchor();
      return;
    }

    reconcileAttemptRef.current += 1;
    reconcileFrameRef.current = requestAnimationFrame(reconcilePendingAnchor);
  }, [resetAnchor, scrollElementRef]);

  /** Starts the DOM-anchor reconciliation loop for one pending restored post view. */
  const scheduleAnchorReconciliation = useCallback(() => {
    if (reconcileFrameRef.current !== null) {
      return;
    }

    reconcileAttemptRef.current = 0;
    reconcileFrameRef.current = requestAnimationFrame(reconcilePendingAnchor);
  }, [reconcilePendingAnchor]);

  /** Scrolls one loaded semantic view into range, then refines the exact DOM offset if needed. */
  const scrollToView = useEffectEvent(
    ({
      align,
      behavior,
      view,
    }: {
      align: ScrollAlignment;
      behavior: ScrollBehavior;
      view: TranscriptView;
    }) => {
      const index = postIdToIndex.get(view.postId);

      if (index === undefined) {
        return false;
      }

      pendingViewAnchorRef.current =
        align === "start"
          ? {
              postId: view.postId,
              topWithinScrollRoot: view.offset,
            }
          : null;

      handleRef.current?.scrollToIndex(index, {
        align,
        smooth: behavior === "smooth",
      });

      if (align === "start") {
        scheduleAnchorReconciliation();
      }

      return true;
    }
  );

  /** Promotes the pending jump highlight once the target post is actually visible. */
  const syncHighlightVisibility = useEffectEvent(() => {
    const scrollElement = scrollElementRef.current;

    if (!(pendingHighlightPostId && scrollElement)) {
      return;
    }

    if (
      !isConversationPostVisibleInDom({
        postId: pendingHighlightPostId,
        scrollElement,
      })
    ) {
      return;
    }

    handleHighlightVisiblePost(pendingHighlightPostId);
  });

  return {
    resetAnchor,
    scrollToView,
    syncHighlightVisibility,
  };
}
