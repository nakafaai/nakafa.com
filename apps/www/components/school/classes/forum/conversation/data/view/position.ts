import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  getConversationDistanceToViewportCenter,
  getConversationPostTargetIndex,
  getConversationRowStart,
  isConversationRowVisible,
} from "@/components/school/classes/forum/conversation/data/scroll/geometry";
import {
  type ConversationGeometryHandle,
  isConversationAtBottom,
} from "@/components/school/classes/forum/conversation/data/scroll/metrics";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/transcript/pages";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view/model";
import { getCenteredConversationPostId } from "@/components/school/classes/forum/conversation/data/view/visible";

/**
 * Captures the current semantic transcript view from the virtualizer metrics.
 *
 * Restore scroll places post views at the viewport center, so persisted post
 * views must also be derived from the row nearest the viewport center. Using
 * the first visible row here would slowly drift the saved view upward across
 * repeated close/open cycles.
 */
export function captureConversationView({
  handle,
  rows,
}: {
  handle: ConversationGeometryHandle;
  rows: readonly ConversationRow[];
}) {
  if (isConversationAtBottom(handle)) {
    return { kind: "bottom" } satisfies ConversationView;
  }

  const centeredPostId = getCenteredConversationPostId({
    handle,
    rows,
  });

  if (!centeredPostId) {
    return null;
  }

  return {
    kind: "post",
    postId: centeredPostId,
  } satisfies ConversationView;
}

/** Returns whether one semantic transcript view is already visible. */
export function isConversationViewVisible({
  handle,
  rowIndexByPostId,
  view,
}: {
  handle: ConversationGeometryHandle;
  rowIndexByPostId: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  view: ConversationView;
}) {
  if (view.kind === "bottom") {
    return isConversationAtBottom(handle);
  }

  const targetIndex = getConversationPostTargetIndex({
    rowIndexByPostId,
    postId: view.postId,
  });

  if (targetIndex === undefined) {
    return false;
  }

  return isConversationRowVisible({
    handle,
    index: targetIndex,
  });
}

/** Returns whether one semantic transcript view is in reading position. */
export function isConversationViewSettled({
  handle,
  rowIndexByPostId,
  view,
}: {
  handle: ConversationGeometryHandle;
  rowIndexByPostId: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  view: ConversationView;
}) {
  if (view.kind === "bottom") {
    return isConversationAtBottom(handle);
  }

  const targetIndex = getConversationPostTargetIndex({
    rowIndexByPostId,
    postId: view.postId,
  });

  if (targetIndex === undefined) {
    return false;
  }

  return (
    getConversationDistanceToViewportCenter({
      handle,
      index: targetIndex,
    }) === 0
  );
}

/**
 * Returns whether the current viewport has reached the semantic back target.
 *
 * A post target counts as reached once it becomes visible or scrolls above the
 * viewport top, which matches the "reached or passed" back-button rule.
 */
export function hasConversationViewReached({
  handle,
  rowIndexByPostId,
  view,
}: {
  handle: ConversationGeometryHandle;
  rowIndexByPostId: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  view: ConversationView;
}) {
  if (isConversationViewVisible({ handle, rowIndexByPostId, view })) {
    return true;
  }

  if (view.kind === "bottom") {
    return false;
  }

  const targetIndex = getConversationPostTargetIndex({
    rowIndexByPostId,
    postId: view.postId,
  });

  if (targetIndex === undefined) {
    return false;
  }

  return getConversationRowStart(handle, targetIndex) <= handle.scrollOffset;
}
