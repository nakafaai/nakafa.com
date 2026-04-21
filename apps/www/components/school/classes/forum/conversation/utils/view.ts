import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumConversationView } from "@/components/school/classes/forum/conversation/models";

export type RestorableConversationView = Extract<
  ForumConversationView,
  { kind: "post" }
>;

export type ForumConversationMode =
  | {
      kind: "jump";
      postId: Id<"schoolClassForumPosts">;
    }
  | {
      kind: "live";
    }
  | {
      kind: "restore";
      postId: Id<"schoolClassForumPosts">;
      view: RestorableConversationView;
    };

/** Compares two persisted conversation views by value. */
export function areConversationViewsEqual(
  left: ForumConversationView | undefined | null,
  right: ForumConversationView | undefined | null
) {
  if (!(left && right)) {
    return left === right;
  }

  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "bottom" || right.kind === "bottom") {
    return left.kind === right.kind;
  }

  return left.postId === right.postId && left.offset === right.offset;
}

/** Chooses the first conversation mode for a fresh mount from one saved view. */
export function createForumConversationMode({
  restoreView,
}: {
  restoreView: ForumConversationView | null;
}): ForumConversationMode {
  if (restoreView?.kind === "post") {
    return {
      kind: "restore",
      postId: restoreView.postId,
      view: restoreView,
    };
  }

  return { kind: "live" };
}

/** Chooses the first persisted conversation view for one newly mounted transcript. */
export function createInitialConversationView({
  existingView,
  mode,
  unreadPostId,
}: {
  existingView: ForumConversationView | null;
  mode: ForumConversationMode;
  unreadPostId: Id<"schoolClassForumPosts"> | null;
}): ForumConversationView {
  if (mode.kind === "restore") {
    return mode.view;
  }

  if (mode.kind === "jump") {
    return {
      kind: "post",
      offset: 0,
      postId: mode.postId,
    };
  }

  if (existingView?.kind === "bottom") {
    return { kind: "bottom" };
  }

  if (unreadPostId) {
    return {
      kind: "post",
      offset: 0,
      postId: unreadPostId,
    };
  }

  return { kind: "bottom" };
}

/** Compares two semantic transcript views in visual scroll order. */
export function compareConversationViews({
  leftView,
  postIdToIndex,
  rightView,
}: {
  leftView: ForumConversationView;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  rightView: ForumConversationView;
}) {
  if (leftView.kind === "bottom") {
    return rightView.kind === "bottom" ? 0 : 1;
  }

  if (rightView.kind === "bottom") {
    return -1;
  }

  const leftIndex = postIdToIndex.get(leftView.postId);
  const rightIndex = postIdToIndex.get(rightView.postId);

  if (leftIndex === undefined || rightIndex === undefined) {
    return null;
  }

  if (leftIndex !== rightIndex) {
    return leftIndex < rightIndex ? -1 : 1;
  }

  if (leftView.offset === rightView.offset) {
    return 0;
  }

  return leftView.offset < rightView.offset ? -1 : 1;
}
