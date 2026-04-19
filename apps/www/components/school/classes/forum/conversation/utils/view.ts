import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumConversationView } from "@/lib/store/forum";

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
  preferBottom,
  unreadPostId,
}: {
  existingView: ForumConversationView | null;
  mode: ForumConversationMode;
  preferBottom: boolean;
  unreadPostId: Id<"schoolClassForumPosts"> | null;
}): ForumConversationView {
  if (preferBottom) {
    return { kind: "bottom" };
  }

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

/** Returns whether the current persisted viewport has reached or passed a target view. */
export function isConversationViewAtOrAfter({
  currentView,
  postIdToIndex,
  targetView,
}: {
  currentView: ForumConversationView;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  targetView: ForumConversationView;
}) {
  if (currentView.kind === "bottom") {
    return true;
  }

  if (targetView.kind === "bottom") {
    return false;
  }

  const currentIndex = postIdToIndex.get(currentView.postId);
  const targetIndex = postIdToIndex.get(targetView.postId);

  if (currentIndex === undefined || targetIndex === undefined) {
    return false;
  }

  if (currentIndex !== targetIndex) {
    return currentIndex > targetIndex;
  }

  return currentView.offset >= targetView.offset;
}
