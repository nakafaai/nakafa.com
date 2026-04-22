import type { Id } from "@repo/backend/convex/_generated/dataModel";

export type ConversationView =
  | { kind: "bottom" }
  | {
      kind: "post";
      offset: number;
      postId: Id<"schoolClassForumPosts">;
    };

/** Returns whether two semantic transcript views point at the same place. */
export function areConversationViewsEqual(
  left: ConversationView | null | undefined,
  right: ConversationView | null | undefined
) {
  if (left?.kind !== right?.kind) {
    return false;
  }

  if (!(left && right)) {
    return left === right;
  }

  if (left.kind === "bottom") {
    return true;
  }

  if (right.kind !== "post") {
    return false;
  }

  return left.postId === right.postId && left.offset === right.offset;
}

/** Returns whether one semantic view is already at the target origin. */
export function hasReachedConversationView(
  currentView: ConversationView | null,
  targetView: ConversationView | null
) {
  if (!(currentView && targetView)) {
    return false;
  }

  if (targetView.kind === "bottom") {
    return currentView.kind === "bottom";
  }

  if (currentView.kind !== "post" || currentView.postId !== targetView.postId) {
    return false;
  }

  return Math.abs(currentView.offset - targetView.offset) <= 1;
}

/** Returns whether the current settled view is already anchored to one post. */
export function isConversationViewAtPost(
  view: ConversationView | null,
  postId: Id<"schoolClassForumPosts">
) {
  return view?.kind === "post" && view.postId === postId;
}
