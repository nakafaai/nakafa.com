import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  VirtualConversationAnchor,
  VirtualConversationHandle,
} from "@repo/design-system/types/virtual";
import { type RefObject, useCallback, useRef } from "react";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import {
  captureConversationView,
  createInitialConversationAnchor,
  createRestoreConversationAnchor,
  type ForumConversationMode,
  type RestorableConversationView,
} from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

interface UseViewResult {
  captureCurrentConversationView: (
    offset?: number
  ) => ForumConversationView | null;
  initialAnchor: VirtualConversationAnchor;
  latestConversationView: RefObject<ForumConversationView | null>;
  persistConversationView: (view?: ForumConversationView | null) => void;
  restoreConversationViewLocally: (view: RestorableConversationView) => boolean;
}

/**
 * Owns semantic forum conversation views: capture, persistence, and restore
 * anchors for the current transcript session.
 */
export function useView({
  conversationIntent,
  dateToIndex,
  forumId,
  headerIndex,
  items,
  postIdToIndex,
  preferBottom,
  saveConversationView,
  savedConversationView,
  scrollRef,
  unreadIndex,
}: {
  conversationIntent: ForumConversationMode;
  dateToIndex: Map<number, number>;
  forumId: Id<"schoolClassForums">;
  headerIndex: number | null;
  items: VirtualItem[];
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  preferBottom: boolean;
  saveConversationView: (
    forumId: Id<"schoolClassForums">,
    view: ForumConversationView
  ) => void;
  savedConversationView: ForumConversationView | null;
  scrollRef: RefObject<VirtualConversationHandle | null>;
  unreadIndex: number | null;
}): UseViewResult {
  const latestConversationView = useRef<ForumConversationView | null>(
    savedConversationView
  );

  /** Resolves the first virtual anchor for the freshly mounted transcript session. */
  const initialAnchor: VirtualConversationAnchor = preferBottom
    ? { kind: "bottom" }
    : createInitialConversationAnchor({
        dateToIndex,
        existingView: latestConversationView.current,
        headerIndex,
        mode: conversationIntent,
        postIdToIndex,
        unreadIndex,
      });

  /** Captures the current viewport into one restorable semantic conversation view. */
  const captureCurrentConversationView = useCallback(
    (offset?: number) => {
      const view = captureConversationView({ items, offset, scrollRef });

      if (!view) {
        return null;
      }

      latestConversationView.current = view;
      return view;
    },
    [items, scrollRef]
  );

  /** Saves the latest semantic view snapshot into the shared forum store. */
  const persistConversationView = useCallback(
    (view?: ForumConversationView | null) => {
      const nextView = view ?? latestConversationView.current;

      if (!nextView) {
        return;
      }

      latestConversationView.current = nextView;
      saveConversationView(forumId, nextView);
    },
    [forumId, saveConversationView]
  );

  /** Restores one saved semantic view immediately when its anchor is already loaded. */
  const restoreConversationViewLocally = useCallback(
    (view: RestorableConversationView) => {
      const anchor = createRestoreConversationAnchor({
        dateToIndex,
        headerIndex,
        postIdToIndex,
        unreadIndex,
        view,
      });

      if (!anchor) {
        return false;
      }

      latestConversationView.current = view;
      persistConversationView(view);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToIndex(anchor.index, {
          align: anchor.align,
          offset: anchor.offset,
        });
      });
      return true;
    },
    [
      dateToIndex,
      headerIndex,
      persistConversationView,
      postIdToIndex,
      scrollRef,
      unreadIndex,
    ]
  );

  return {
    captureCurrentConversationView,
    initialAnchor,
    latestConversationView,
    persistConversationView,
    restoreConversationViewLocally,
  };
}
