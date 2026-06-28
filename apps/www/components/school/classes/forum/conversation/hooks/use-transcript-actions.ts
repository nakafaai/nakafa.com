"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/active-transcript";
import type { ConversationScrollController } from "@/components/school/classes/forum/conversation/data/scroll";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";
import { isConversationViewAtPost } from "@/components/school/classes/forum/conversation/data/view";
import type { TranscriptPlacementState } from "@/components/school/classes/forum/conversation/hooks/use-placement";
import type { TranscriptRefs } from "@/components/school/classes/forum/conversation/hooks/use-transcript-refs";

interface TranscriptActionHandlers {
  clearHighlightedPost: () => void;
  clearHighlightTimeout: () => void;
  highlightPost: (postId: Id<"schoolClassForumPosts">) => void;
  popBackView: () => ConversationView | null;
  pushBackView: (view: ConversationView) => void;
  startHighlightTimeout: () => void;
}

/** Builds user-facing transcript navigation commands from scroll primitives. */
export function useTranscriptActions({
  activeTranscript,
  flushPendingPlacement,
  handlers,
  placement,
  refs,
  scrollController,
}: {
  activeTranscript: ActiveTranscriptModel;
  flushPendingPlacement: () => void;
  handlers: TranscriptActionHandlers;
  placement: TranscriptPlacementState;
  refs: TranscriptRefs;
  scrollController: ConversationScrollController;
}) {
  const goToPost = (postId: Id<"schoolClassForumPosts">) => {
    if (!activeTranscript.rowIndexByPostId.has(postId)) {
      return;
    }

    const targetView = { kind: "post", postId } satisfies ConversationView;
    handlers.clearHighlightTimeout();
    handlers.clearHighlightedPost();

    if (scrollController.isViewSettled(targetView)) {
      handlers.highlightPost(postId);
      handlers.startHighlightTimeout();
      return;
    }

    const currentView = scrollController.captureView();

    if (currentView && !isConversationViewAtPost(currentView, postId)) {
      handlers.pushBackView(currentView);
    }

    placement.setPendingPlacement({
      align: "center",
      behavior: "smooth",
      completion: "settled",
      highlightPostId: postId,
      view: targetView,
    });
    flushPendingPlacement();
  };

  const goToLatest = () => {
    placement.setPendingPlacement({
      behavior: "smooth",
      completion: "reached",
      highlightPostId: null,
      view: { kind: "bottom" },
    });
    handlers.clearHighlightTimeout();
    handlers.clearHighlightedPost();
    flushPendingPlacement();
  };

  const goBack = () => {
    const backView = handlers.popBackView();

    if (!backView) {
      return;
    }

    if (
      backView.kind === "post" &&
      !refs.postIdsRef.current.includes(backView.postId)
    ) {
      goToLatest();
      return;
    }

    if (backView.kind === "bottom") {
      placement.setPendingPlacement({
        behavior: "smooth",
        completion: "reached",
        highlightPostId: null,
        view: backView,
      });
    } else {
      placement.setPendingPlacement({
        align: "center",
        behavior: "smooth",
        completion: "settled",
        highlightPostId: null,
        view: backView,
      });
    }

    handlers.clearHighlightTimeout();
    handlers.clearHighlightedPost();
    flushPendingPlacement();
  };

  return {
    goBack,
    goToLatest,
    goToPost,
  };
}
