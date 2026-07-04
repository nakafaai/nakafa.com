import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { isOptimisticForumPost } from "@/components/school/classes/forum/conversation/data/entities";
import {
  getConversationDistanceToViewportCenter,
  getVisibleConversationIndexRange,
  isConversationRowVisible,
} from "@/components/school/classes/forum/conversation/data/scroll/geometry";
import type { ConversationGeometryHandle } from "@/components/school/classes/forum/conversation/data/scroll/metrics";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/transcript/pages";

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

    const row = rows[index];

    if (row?.type === "post" && !isOptimisticForumPost(row.post)) {
      return row.post._id;
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

    const row = rows[index];

    if (row?.type === "post" && !isOptimisticForumPost(row.post)) {
      return row.post._id;
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
    const row = rows[index];

    if (
      row?.type !== "post" ||
      isOptimisticForumPost(row.post) ||
      !isConversationRowVisible({ handle, index })
    ) {
      continue;
    }

    const distance = getConversationDistanceToViewportCenter({ handle, index });

    if (distance < shortestDistance) {
      centeredPostId = row.post._id;
      shortestDistance = distance;
    }
  }

  return centeredPostId;
}
