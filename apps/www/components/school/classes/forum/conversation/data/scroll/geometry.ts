import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ConversationGeometryHandle } from "@/components/school/classes/forum/conversation/data/scroll/metrics";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/transcript/pages";

/** Clamps one row index into the currently rendered transcript range. */
export function clampConversationIndex(index: number, itemCount: number) {
  return Math.max(0, Math.min(itemCount - 1, index));
}

/** Returns the post id for post rows and ignores structural rows. */
export function getConversationPostId(row: ConversationRow | undefined) {
  if (row?.type !== "post") {
    return null;
  }

  return row.post._id;
}

/** Returns the absolute offset of the viewport center line. */
export function getConversationViewportCenter(
  handle: ConversationGeometryHandle
) {
  return handle.scrollOffset + handle.viewportSize / 2;
}

/** Returns one row's absolute start offset from virtualizer geometry. */
export function getConversationRowStart(
  handle: ConversationGeometryHandle,
  index: number
) {
  return handle.getItemOffset(index);
}

/** Returns one row's absolute end offset from virtualizer geometry. */
export function getConversationRowEnd(
  handle: ConversationGeometryHandle,
  index: number
) {
  return getConversationRowStart(handle, index) + handle.getItemSize(index);
}

/** Returns one row's absolute center offset from virtualizer geometry. */
export function getConversationRowCenter(
  handle: ConversationGeometryHandle,
  index: number
) {
  return (
    (getConversationRowStart(handle, index) +
      getConversationRowEnd(handle, index)) /
    2
  );
}

/** Returns whether one row intersects the current viewport. */
export function isConversationRowVisible({
  handle,
  index,
}: {
  handle: ConversationGeometryHandle;
  index: number;
}) {
  const viewportStart = handle.scrollOffset;
  const viewportEnd = viewportStart + handle.viewportSize;
  const rowStart = getConversationRowStart(handle, index);
  const rowEnd = getConversationRowEnd(handle, index);

  return rowEnd > viewportStart && rowStart < viewportEnd;
}

/** Returns the nearest visible index bounds for the current viewport. */
export function getVisibleConversationIndexRange({
  handle,
  itemCount,
}: {
  handle: ConversationGeometryHandle;
  itemCount: number;
}) {
  if (handle.viewportSize <= 0) {
    return null;
  }

  if (itemCount === 0) {
    return null;
  }

  const viewportStart = handle.scrollOffset;
  const viewportEnd = viewportStart + handle.viewportSize;

  return {
    firstVisibleIndex: clampConversationIndex(
      handle.findItemIndex(viewportStart),
      itemCount
    ),
    lastVisibleIndex: clampConversationIndex(
      handle.findItemIndex(viewportEnd),
      itemCount
    ),
  };
}

/** Looks up the rendered row index for one post id. */
export function getConversationPostTargetIndex({
  rowIndexByPostId,
  postId,
}: {
  rowIndexByPostId: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  postId: Id<"schoolClassForumPosts">;
}) {
  return rowIndexByPostId.get(postId);
}

/** Returns how far one row is from the viewport center line. */
export function getConversationDistanceToViewportCenter({
  handle,
  index,
}: {
  handle: ConversationGeometryHandle;
  index: number;
}) {
  const viewportCenter = getConversationViewportCenter(handle);
  const rowStart = getConversationRowStart(handle, index);
  const rowEnd = getConversationRowEnd(handle, index);

  if (rowStart <= viewportCenter && rowEnd >= viewportCenter) {
    return 0;
  }

  if (rowEnd < viewportCenter) {
    return viewportCenter - rowEnd;
  }

  return rowStart - viewportCenter;
}

/** Returns the viewport-center tolerance used by transcript post placement. */
export function getConversationCenterThreshold(viewportSize: number) {
  return Math.max(32, Math.min(96, viewportSize * 0.12));
}
