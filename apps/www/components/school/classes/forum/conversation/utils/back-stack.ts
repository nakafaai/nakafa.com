import { areConversationViewsEqual } from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

const MAX_BACK_STACK_SIZE = 5;

export type BackStack = ForumConversationView[];

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
  view,
}: {
  backStack: BackStack;
  view: ForumConversationView;
}): BackStack {
  const lastView = peekBackView(backStack);

  if (lastView && areConversationViewsEqual(lastView, view)) {
    return backStack;
  }

  const nextBackStack = [...backStack, view];

  if (nextBackStack.length <= MAX_BACK_STACK_SIZE) {
    return nextBackStack;
  }

  return nextBackStack.slice(nextBackStack.length - MAX_BACK_STACK_SIZE);
}

/** Pops the latest back destination and returns both the view and next stack. */
export function popBackView(backStack: BackStack) {
  const view = peekBackView(backStack);

  if (!view) {
    return {
      backStack,
      view: null,
    };
  }

  return {
    backStack: backStack.slice(0, -1),
    view,
  };
}
