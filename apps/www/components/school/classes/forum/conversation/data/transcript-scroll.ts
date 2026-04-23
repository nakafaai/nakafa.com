import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ScrollToIndexOpts, VirtualizerHandle } from "virtua";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/pages";
import {
  captureConversationView,
  hasConversationViewReached,
  hasConversationViewSettledPlacement,
} from "@/components/school/classes/forum/conversation/data/settled-view";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";

type ScrollTargetAlign = NonNullable<ScrollToIndexOpts["align"]>;
type ConversationScrollHandle = Parameters<
  typeof captureConversationView
>[0]["handle"] &
  Pick<VirtualizerHandle, "scrollTo" | "scrollToIndex">;

interface ScrollTargetOptions {
  align?: ScrollTargetAlign;
  behavior?: ScrollBehavior;
}

export interface ConversationScrollController {
  captureView: () => ConversationView | null;
  isViewReached: (view: ConversationView) => boolean;
  isViewSettled: (view: ConversationView) => boolean;
  scrollToLatest: (options?: ScrollTargetOptions) => boolean;
  scrollToPost: (
    postId: Id<"schoolClassForumPosts">,
    options?: ScrollTargetOptions
  ) => boolean;
}

/** Maps DOM-style scroll behavior to Virtua's `smooth` flag. */
function resolveScrollMode({
  behavior,
  prefersReducedMotion,
}: {
  behavior: ScrollBehavior | undefined;
  prefersReducedMotion: boolean;
}) {
  if (prefersReducedMotion) {
    return false;
  }

  if (behavior === "auto" || behavior === "instant") {
    return false;
  }

  return true;
}

/**
 * Creates the transcript scroll boundary over one current active transcript.
 *
 * Every geometry check comes from `VirtualizerHandle`, which keeps this
 * controller aligned with the official `virtua` chat and scrolling examples.
 */
export function createConversationScrollController({
  prefersReducedMotion,
  rowIndexByPostId,
  rows,
  virtualizerRef,
}: {
  prefersReducedMotion: boolean;
  rowIndexByPostId: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  rows: readonly ConversationRow[];
  virtualizerRef: { current: ConversationScrollHandle | null };
}) {
  return {
    captureView: () => {
      const handle = virtualizerRef.current;

      if (!handle) {
        return null;
      }

      return captureConversationView({
        handle,
        rows,
      });
    },

    isViewReached: (view) => {
      const handle = virtualizerRef.current;

      if (!handle) {
        return false;
      }

      return hasConversationViewReached({
        handle,
        rowIndexByPostId,
        view,
      });
    },

    isViewSettled: (view) => {
      const handle = virtualizerRef.current;

      if (!handle) {
        return false;
      }

      return hasConversationViewSettledPlacement({
        handle,
        rowIndexByPostId,
        view,
      });
    },

    scrollToLatest: (options?: ScrollTargetOptions) => {
      const handle = virtualizerRef.current;
      const lastRowIndex = rows.length - 1;

      if (!handle) {
        return false;
      }

      if (lastRowIndex < 0) {
        return false;
      }

      handle.scrollToIndex(lastRowIndex, {
        align: "end",
        smooth: resolveScrollMode({
          behavior: options?.behavior,
          prefersReducedMotion,
        }),
      });

      return true;
    },

    scrollToPost: (
      postId: Id<"schoolClassForumPosts">,
      options?: ScrollTargetOptions
    ) => {
      const handle = virtualizerRef.current;

      if (!handle) {
        return false;
      }

      const targetIndex = rowIndexByPostId.get(postId);

      if (targetIndex === undefined) {
        return false;
      }

      handle.scrollToIndex(targetIndex, {
        align: options?.align ?? "center",
        smooth: resolveScrollMode({
          behavior: options?.behavior,
          prefersReducedMotion,
        }),
      });

      return true;
    },
  } satisfies ConversationScrollController;
}
