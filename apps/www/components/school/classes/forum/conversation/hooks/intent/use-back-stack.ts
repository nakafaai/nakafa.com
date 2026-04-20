import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useCallback, useRef, useState } from "react";
import {
  clearBackStack,
  peekBackView,
  popBackView,
  pushBackView,
} from "@/components/school/classes/forum/conversation/utils/back-stack";
import { isConversationViewAtOrAfter } from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

/** Owns the transient jump-back stack for one mounted conversation session. */
export function useConversationBackStack({
  postIdToIndex,
}: {
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
}) {
  const backStackRef = useRef<ForumConversationView[]>(clearBackStack());
  const [canGoBack, setCanGoBack] = useState(false);

  const applyBackStack = useCallback((backStack: ForumConversationView[]) => {
    backStackRef.current = backStack;
    setCanGoBack(backStack.length > 0);
  }, []);

  const clearJumpHistory = useCallback(() => {
    applyBackStack(clearBackStack());
  }, [applyBackStack]);

  const pruneReachedBackHistory = useCallback(
    (currentView: ForumConversationView) => {
      let nextBackStack = backStackRef.current;

      while (true) {
        const targetView = peekBackView(nextBackStack);

        if (
          !(
            targetView &&
            isConversationViewAtOrAfter({
              currentView,
              postIdToIndex,
              targetView,
            })
          )
        ) {
          break;
        }

        nextBackStack = popBackView(nextBackStack).backStack;
      }

      if (nextBackStack !== backStackRef.current) {
        applyBackStack(nextBackStack);
      }
    },
    [applyBackStack, postIdToIndex]
  );

  const pushCurrentViewToBackStack = useCallback(
    (view: ForumConversationView | null) => {
      if (!view) {
        return;
      }

      applyBackStack(
        pushBackView({
          backStack: backStackRef.current,
          view,
        })
      );
    },
    [applyBackStack]
  );

  const takeBackView = useCallback(() => {
    const { backStack, view } = popBackView(backStackRef.current);

    if (!view) {
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
