import type { ForumConversationView } from "@/components/school/classes/forum/conversation/store/forum";
import { areConversationViewsEqual } from "@/components/school/classes/forum/conversation/utils/view";

const MAX_BACK_STACK_SIZE = 5;

export interface BackStackEntry {
  dismissWhen: "at-or-after-origin" | "at-or-before-origin" | "exact-origin";
  originView: ForumConversationView;
}

export type BackStack = BackStackEntry[];

/** Returns one empty transient back stack. */
export function clearBackStack(): BackStack {
  return [];
}

/** Returns the current back destination without mutating the stack. */
export function peekBackView(backStack: BackStack) {
  return backStack.at(-1) ?? null;
}

/** Pushes one new back destination while bounding stack growth. */
export function pushBackView({
  backStack,
  entry,
}: {
  backStack: BackStack;
  entry: BackStackEntry;
}): BackStack {
  const lastEntry = peekBackView(backStack);

  if (
    lastEntry &&
    lastEntry.dismissWhen === entry.dismissWhen &&
    areConversationViewsEqual(lastEntry.originView, entry.originView)
  ) {
    return backStack;
  }

  const nextBackStack = [...backStack, entry];

  if (nextBackStack.length <= MAX_BACK_STACK_SIZE) {
    return nextBackStack;
  }

  return nextBackStack.slice(nextBackStack.length - MAX_BACK_STACK_SIZE);
}

/** Pops the latest back destination and returns both the view and next stack. */
export function popBackView(backStack: BackStack) {
  const entry = peekBackView(backStack);

  if (!entry) {
    return {
      backStack,
      entry: null,
    };
  }

  return {
    backStack: backStack.slice(0, -1),
    entry,
  };
}
