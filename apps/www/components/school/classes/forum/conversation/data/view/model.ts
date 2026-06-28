import type { Id } from "@repo/backend/convex/_generated/dataModel";

export type ConversationView =
  | { kind: "bottom" }
  | {
      kind: "post";
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

  return right.kind === "post" && left.postId === right.postId;
}

/** Returns whether the current settled view is already anchored to one post. */
export function isConversationViewAtPost(
  view: ConversationView | null,
  postId: Id<"schoolClassForumPosts">
) {
  return view?.kind === "post" && view.postId === postId;
}
