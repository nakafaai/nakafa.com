import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualizerHandle } from "virtua";
import {
  type ConversationRow,
  FORUM_BOTTOM_THRESHOLD,
} from "@/components/school/classes/forum/conversation/data/pages";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view";

type ConversationGeometryHandle = Pick<
  VirtualizerHandle,
  | "findItemIndex"
  | "getItemOffset"
  | "getItemSize"
  | "scrollOffset"
  | "scrollSize"
  | "viewportSize"
>;

function clampConversationIndex(index: number, itemCount: number) {
  return Math.max(0, Math.min(itemCount - 1, index));
}

function getConversationPostId(row: ConversationRow | undefined) {
  if (row?.type !== "post") {
    return null;
  }

  return row.post._id;
}

function getConversationViewportCenter(handle: ConversationGeometryHandle) {
  return handle.scrollOffset + handle.viewportSize / 2;
}

function getConversationRowStart(
  handle: ConversationGeometryHandle,
  index: number
) {
  return handle.getItemOffset(index);
}

function getConversationRowEnd(
  handle: ConversationGeometryHandle,
  index: number
) {
  return getConversationRowStart(handle, index) + handle.getItemSize(index);
}

function getConversationRowCenter(
  handle: ConversationGeometryHandle,
  index: number
) {
  return (
    (getConversationRowStart(handle, index) +
      getConversationRowEnd(handle, index)) /
    2
  );
}

function isConversationRowVisible({
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

function getVisibleConversationIndexRange({
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

function getConversationPostTargetIndex({
  rowIndexByPostId,
  postId,
}: {
  rowIndexByPostId: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  postId: Id<"schoolClassForumPosts">;
}) {
  return rowIndexByPostId.get(postId);
}

function getConversationDistanceToViewportCenter({
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

/** Returns the current bottom distance from the active virtualizer metrics. */
export function getConversationBottomDistance(
  handle: ConversationGeometryHandle
) {
  return Math.max(
    0,
    handle.scrollSize - handle.viewportSize - handle.scrollOffset
  );
}

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
  if (getConversationBottomDistance(handle) <= FORUM_BOTTOM_THRESHOLD) {
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
    return getConversationBottomDistance(handle) <= FORUM_BOTTOM_THRESHOLD;
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

/**
 * Returns whether one semantic transcript view is already centered.
 *
 * `go to message` should keep scrolling until the target row reaches the
 * viewport center, even if that row is already only partially visible.
 */
export function isConversationViewCentered({
  handle,
  rowIndexByPostId,
  view,
}: {
  handle: ConversationGeometryHandle;
  rowIndexByPostId: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  view: ConversationView;
}) {
  if (view.kind === "bottom") {
    return getConversationBottomDistance(handle) <= FORUM_BOTTOM_THRESHOLD;
  }

  const targetIndex = getConversationPostTargetIndex({
    rowIndexByPostId,
    postId: view.postId,
  });

  if (targetIndex === undefined) {
    return false;
  }

  if (!isConversationRowVisible({ handle, index: targetIndex })) {
    return false;
  }

  return (
    Math.abs(
      getConversationRowCenter(handle, targetIndex) -
        getConversationViewportCenter(handle)
    ) <= getConversationCenterThreshold(handle.viewportSize)
  );
}

/**
 * Returns whether one semantic post placement has settled as far as the
 * virtualizer can place it.
 */
export function hasConversationViewSettledPlacement({
  handle,
  rowIndexByPostId,
  view,
}: {
  handle: ConversationGeometryHandle;
  rowIndexByPostId: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  view: ConversationView;
}) {
  if (isConversationViewCentered({ handle, rowIndexByPostId, view })) {
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

  if (!isConversationRowVisible({ handle, index: targetIndex })) {
    return false;
  }

  const targetCenter = getConversationRowCenter(handle, targetIndex);
  const viewportCenter = getConversationViewportCenter(handle);

  if (targetCenter < viewportCenter) {
    return handle.scrollOffset <= FORUM_BOTTOM_THRESHOLD;
  }

  return getConversationBottomDistance(handle) <= FORUM_BOTTOM_THRESHOLD;
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
