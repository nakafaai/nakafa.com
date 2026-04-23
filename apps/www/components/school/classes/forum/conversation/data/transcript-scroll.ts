import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import type { VirtualizerHandle } from "virtua";
import { FORUM_BOTTOM_THRESHOLD } from "@/components/school/classes/forum/conversation/data/pages";
import {
  captureConversationView,
  getConversationBottomDistance,
  hasConversationViewSettledPlacement,
  isConversationViewVisible,
} from "@/components/school/classes/forum/conversation/data/settled-view";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";

interface ScrollTargetOptions {
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

function clampIndex(index: number, itemCount: number) {
  return Math.max(0, Math.min(itemCount - 1, index));
}

function getCenteredThreshold(viewportSize: number) {
  return Math.max(32, Math.min(96, viewportSize * 0.12));
}

function getVisibleIndexRange({
  itemCount,
  handle,
}: {
  itemCount: number;
  handle: VirtualizerHandle;
}) {
  if (itemCount === 0 || handle.viewportSize <= 0) {
    return null;
  }

  const startOffset = handle.scrollOffset;
  const endOffset = startOffset + handle.viewportSize;

  return {
    firstVisibleIndex: clampIndex(handle.findItemIndex(startOffset), itemCount),
    lastVisibleIndex: clampIndex(handle.findItemIndex(endOffset), itemCount),
  };
}

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

  return behavior !== "auto";
}

/**
 * Creates the transcript scroll boundary over one current active transcript.
 *
 * Phase 1 still captures semantic view from mounted DOM rows, but it uses
 * virtualizer indexes to jump and to tolerate off-screen rows not being mounted.
 * Scroll commands stay smooth by default unless reduced motion is enabled or
 * one caller explicitly requests `auto`.
 */
export function createConversationScrollController({
  lastRowIndex,
  postIds,
  prefersReducedMotion,
  rowIndexByPostId,
  scrollRootRef,
  virtualizerRef,
}: {
  lastRowIndex: number | null;
  postIds: Id<"schoolClassForumPosts">[];
  prefersReducedMotion: boolean;
  rowIndexByPostId: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  scrollRootRef: RefObject<HTMLElement | null>;
  virtualizerRef: RefObject<VirtualizerHandle | null>;
}) {
  return {
    captureView: () => {
      const root = scrollRootRef.current;

      if (!root) {
        return null;
      }

      return captureConversationView({
        postIds,
        root,
      });
    },

    isViewReached: (view) => {
      const root = scrollRootRef.current;

      if (!root) {
        return false;
      }

      if (view.kind === "bottom") {
        return getConversationBottomDistance(root) <= FORUM_BOTTOM_THRESHOLD;
      }

      if (isConversationViewVisible({ root, view })) {
        return true;
      }

      const handle = virtualizerRef.current;
      const targetIndex = rowIndexByPostId.get(view.postId);

      if (handle && targetIndex !== undefined) {
        const range = getVisibleIndexRange({
          handle,
          itemCount: lastRowIndex === null ? 0 : lastRowIndex + 1,
        });

        if (range && targetIndex <= range.lastVisibleIndex) {
          return true;
        }
      }

      const element = root.querySelector<HTMLElement>(
        `[data-post-id="${view.postId}"]`
      );

      if (!element) {
        return false;
      }

      return (
        element.getBoundingClientRect().top <= root.getBoundingClientRect().top
      );
    },

    isViewSettled: (view) => {
      const root = scrollRootRef.current;

      if (!root) {
        return false;
      }

      if (view.kind === "bottom") {
        return getConversationBottomDistance(root) <= FORUM_BOTTOM_THRESHOLD;
      }

      if (hasConversationViewSettledPlacement({ root, view })) {
        return true;
      }

      const handle = virtualizerRef.current;
      const targetIndex = rowIndexByPostId.get(view.postId);

      if (!(handle && targetIndex !== undefined) || handle.viewportSize <= 0) {
        return false;
      }

      const viewportCenter = handle.scrollOffset + handle.viewportSize / 2;
      const targetCenter =
        handle.getItemOffset(targetIndex) + handle.getItemSize(targetIndex) / 2;
      const centerThreshold = getCenteredThreshold(handle.viewportSize);

      if (Math.abs(targetCenter - viewportCenter) <= centerThreshold) {
        return true;
      }

      if (targetCenter < viewportCenter) {
        return handle.scrollOffset <= FORUM_BOTTOM_THRESHOLD;
      }

      return getConversationBottomDistance(root) <= FORUM_BOTTOM_THRESHOLD;
    },

    scrollToLatest: (options?: ScrollTargetOptions) => {
      const handle = virtualizerRef.current;

      if (!(handle && lastRowIndex !== null)) {
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
      const targetIndex = rowIndexByPostId.get(postId);

      if (!(handle && targetIndex !== undefined)) {
        return false;
      }

      handle.scrollToIndex(targetIndex, {
        align: "center",
        smooth: resolveScrollMode({
          behavior: options?.behavior,
          prefersReducedMotion,
        }),
      });
      return true;
    },
  } satisfies ConversationScrollController;
}
