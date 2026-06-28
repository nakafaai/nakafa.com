import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  getConversationDistanceToViewportCenter,
  getConversationPostId,
  getVisibleConversationIndexRange,
  isConversationRowVisible,
} from "@/components/school/classes/forum/conversation/data/geometry";
import type { ConversationGeometryHandle } from "@/components/school/classes/forum/conversation/data/metrics";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/pages";

/** Returns the first visible post id inside the current transcript viewport. */
export function getFirstVisibleConversationPostId({
  handle,
  rows,
}: {
  handle: ConversationGeometryHandle;
  rows: readonly ConversationRow[];
}) {
  const range = getVisibleConversationIndexRange({
    handle,
    itemCount: rows.length,
  });

  if (!range) {
    return null;
  }

  for (
    let index = range.firstVisibleIndex;
    index <= range.lastVisibleIndex;
    index += 1
  ) {
    if (!isConversationRowVisible({ handle, index })) {
      continue;
    }

    const postId = getConversationPostId(rows[index]);

    if (postId) {
      return postId;
    }
  }

  return null;
}

/** Returns the last visible post id inside the current transcript viewport. */
export function getLastVisibleConversationPostId({
  handle,
  rows,
}: {
  handle: ConversationGeometryHandle;
  rows: readonly ConversationRow[];
}) {
  const range = getVisibleConversationIndexRange({
    handle,
    itemCount: rows.length,
  });

  if (!range) {
    return null;
  }

  for (
    let index = range.lastVisibleIndex;
    index >= range.firstVisibleIndex;
    index -= 1
  ) {
    if (!isConversationRowVisible({ handle, index })) {
      continue;
    }

    const postId = getConversationPostId(rows[index]);

    if (postId) {
      return postId;
    }
  }

  return null;
}

/** Returns the visible post id closest to the viewport center line. */
export function getCenteredConversationPostId({
  handle,
  rows,
}: {
  handle: ConversationGeometryHandle;
  rows: readonly ConversationRow[];
}) {
  const range = getVisibleConversationIndexRange({
    handle,
    itemCount: rows.length,
  });

  if (!range) {
    return null;
  }

  let centeredPostId: Id<"schoolClassForumPosts"> | null = null;
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (
    let index = range.firstVisibleIndex;
    index <= range.lastVisibleIndex;
    index += 1
  ) {
    const postId = getConversationPostId(rows[index]);

    if (!(postId && isConversationRowVisible({ handle, index }))) {
      continue;
    }

    const distance = getConversationDistanceToViewportCenter({ handle, index });

    if (distance < shortestDistance) {
      centeredPostId = postId;
      shortestDistance = distance;
    }
  }

  return centeredPostId;
}
