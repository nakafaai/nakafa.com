import type { ForumConversationView } from "@/components/school/classes/forum/conversation/models";
import type { ConversationRuntimeStore } from "@/components/school/classes/forum/conversation/store/runtime/types";
import type { BackStackEntry } from "@/components/school/classes/forum/conversation/utils/back-stack";
import { pushBackView } from "@/components/school/classes/forum/conversation/utils/back-stack";
import {
  areConversationViewsEqual,
  compareConversationViews,
} from "@/components/school/classes/forum/conversation/utils/view";

/** Chooses how one back entry should disappear once the user reaches its origin again. */
function getBackDismissWhen(
  comparison: number | null
): BackStackEntry["dismissWhen"] {
  if (comparison === null) {
    return "exact-origin";
  }

  if (comparison < 0) {
    return "at-or-before-origin";
  }

  return "at-or-after-origin";
}

/** Returns whether the current semantic view has already reached one back origin. */
function hasReachedBackOrigin({
  comparison,
  currentView,
  entry,
}: {
  comparison: number | null;
  currentView: ForumConversationView;
  entry: BackStackEntry;
}) {
  if (comparison === null) {
    return (
      entry.originView.kind === "post" &&
      currentView.kind === "post" &&
      currentView.postId === entry.originView.postId
    );
  }

  if (entry.dismissWhen === "at-or-after-origin") {
    return comparison >= 0;
  }

  if (entry.dismissWhen === "at-or-before-origin") {
    return comparison <= 0;
  }

  return comparison === 0;
}

/** Clears the current transient jump highlight and any scheduled timeout. */
export function clearHighlightState(state: ConversationRuntimeStore) {
  if (state.highlightTimeoutId !== null) {
    window.clearTimeout(state.highlightTimeoutId);
  }

  state.highlightTimeoutId = null;
  state.highlightedPostId = null;
  state.pendingHighlightPostId = null;
  state.pendingJumpProtectionPostId = null;
}

/** Removes stale back entries once the user has reached their origin again. */
export function pruneReachedBackHistory(state: ConversationRuntimeStore) {
  const currentView = state.settledConversationView;

  if (!currentView) {
    return;
  }

  let nextBackStack = state.backStack;

  while (nextBackStack.length > 0) {
    const entry = nextBackStack.at(-1) as BackStackEntry;

    const comparison = compareConversationViews({
      leftView: currentView,
      postIdToIndex: state.postIdToIndex,
      rightView: entry.originView,
    });

    if (!hasReachedBackOrigin({ comparison, currentView, entry })) {
      break;
    }

    nextBackStack = nextBackStack.slice(0, -1);
  }

  state.backStack = nextBackStack;
}

/** Captures the current settled view as a meaningful back origin for a jump. */
export function maybePushCurrentViewToBackStack(
  state: ConversationRuntimeStore,
  targetView: ForumConversationView
) {
  const currentView = state.settledConversationView;

  if (!currentView || areConversationViewsEqual(currentView, targetView)) {
    return;
  }

  const comparison = compareConversationViews({
    leftView: currentView,
    postIdToIndex: state.postIdToIndex,
    rightView: targetView,
  });

  state.backStack = pushBackView({
    backStack: state.backStack,
    entry: {
      dismissWhen: getBackDismissWhen(comparison),
      originView: currentView,
    },
  });
}
