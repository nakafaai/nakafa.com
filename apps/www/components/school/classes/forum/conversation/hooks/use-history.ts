import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type RefObject, useCallback, useRef, useState } from "react";
import {
  type BackStack,
  clearBackStack,
  peekBackView,
  popBackView,
  pushBackView,
} from "@/components/school/classes/forum/conversation/utils/back-stack";
import { isConversationViewAtOrAfter } from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

interface UseHistoryResult {
  canGoBack: boolean;
  clearJumpHistory: () => void;
  pruneReachedBackHistory: (currentView: ForumConversationView | null) => void;
  pushCurrentViewToBackStack: () => void;
  takeBackView: () => ForumConversationView | null;
}

/** Returns whether one semantic conversation view is safe to keep as back history. */
function isBackTarget(view: ForumConversationView | null) {
  if (!view) {
    return false;
  }

  if (view.kind === "bottom") {
    return true;
  }

  return view.postId !== null;
}

/**
 * Owns transient reply-jump history so the conversation can offer contextual
 * Back behavior without persisting that stack across sessions.
 */
export function useHistory({
  captureCurrentConversationView,
  dateToIndex,
  headerIndex,
  latestConversationView,
  postIdToIndex,
  unreadIndex,
}: {
  captureCurrentConversationView: (
    offset?: number
  ) => ForumConversationView | null;
  dateToIndex: Map<number, number>;
  headerIndex: number | null;
  latestConversationView: RefObject<ForumConversationView | null>;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  unreadIndex: number | null;
}): UseHistoryResult {
  const [canGoBack, setCanGoBack] = useState(false);
  const backStackRef = useRef<BackStack>(clearBackStack());

  /** Applies one updated transient back stack and keeps the UI flag in sync. */
  const applyBackStack = useCallback((backStack: BackStack) => {
    backStackRef.current = backStack;
    setCanGoBack(backStack.length > 0);
  }, []);

  /** Clears all transient reply-jump history for the active conversation session. */
  const clearJumpHistory = useCallback(() => {
    applyBackStack(clearBackStack());
  }, [applyBackStack]);

  /** Drops any back destinations that the current viewport has already reached. */
  const pruneReachedBackHistory = useCallback(
    (currentView: ForumConversationView | null) => {
      if (!currentView) {
        return;
      }

      let nextBackStack = backStackRef.current;

      while (true) {
        const targetView = peekBackView(nextBackStack);

        if (
          !(
            targetView &&
            isConversationViewAtOrAfter({
              currentView,
              dateToIndex,
              headerIndex,
              postIdToIndex,
              targetView,
              unreadIndex,
            })
          )
        ) {
          break;
        }

        nextBackStack = popBackView(nextBackStack).backStack;
      }

      if (nextBackStack === backStackRef.current) {
        return;
      }

      applyBackStack(nextBackStack);
    },
    [applyBackStack, dateToIndex, headerIndex, postIdToIndex, unreadIndex]
  );

  /** Pushes the current semantic viewport so the next jump can come back here. */
  const pushCurrentViewToBackStack = useCallback(() => {
    const currentView =
      captureCurrentConversationView() ?? latestConversationView.current;

    if (!(currentView && isBackTarget(currentView))) {
      return;
    }

    applyBackStack(
      pushBackView({
        backStack: backStackRef.current,
        view: currentView,
      })
    );
  }, [applyBackStack, captureCurrentConversationView, latestConversationView]);

  /** Pops and returns the latest transient back destination when it is usable. */
  const takeBackView = useCallback(() => {
    const { backStack, view } = popBackView(backStackRef.current);

    if (!(view && isBackTarget(view))) {
      return null;
    }

    applyBackStack(backStack);
    return view;
  }, [applyBackStack]);

  return {
    canGoBack,
    clearJumpHistory,
    pruneReachedBackHistory,
    pushCurrentViewToBackStack,
    takeBackView,
  };
}
