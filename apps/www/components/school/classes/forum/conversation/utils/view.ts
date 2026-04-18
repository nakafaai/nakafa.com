import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  VirtualConversationAnchor,
  VirtualConversationHandle,
} from "@repo/design-system/components/ui/virtual-conversation";
import type { RefObject } from "react";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import type { ForumConversationView } from "@/lib/store/forum";

export type RestorableConversationView = Exclude<
  ForumConversationView,
  { kind: "bottom" }
>;

type RestoreConversationAnchor = Extract<
  VirtualConversationAnchor,
  { kind: "index" }
>;

/** Compares two saved forum conversation views by value. */
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

  if (left.kind === "date" && right.kind === "date") {
    return (
      left.date === right.date &&
      left.postId === right.postId &&
      left.offset === right.offset
    );
  }

  return left.postId === right.postId && left.offset === right.offset;
}

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
      postId: Id<"schoolClassForumPosts"> | null;
      view: RestorableConversationView;
    };

/** Finds the first post id after one virtual item index. */
function findNextPostId(
  items: VirtualItem[],
  startIndex: number
): Id<"schoolClassForumPosts"> | null {
  for (let index = startIndex + 1; index < items.length; index += 1) {
    const item = items[index];

    if (item?.type === "post") {
      return item.post._id;
    }
  }

  return null;
}

/** Resolves the primary post id used to bootstrap restore data windows. */
function getRestoreTargetPostId(view: RestorableConversationView) {
  return view.postId;
}

/** Resolves one saved semantic view back into the current virtual item index. */
function resolveConversationViewIndex({
  dateToIndex,
  headerIndex,
  postIdToIndex,
  unreadIndex,
  view,
}: {
  dateToIndex: Map<number, number>;
  headerIndex: number | null;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  unreadIndex: number | null;
  view: RestorableConversationView;
}) {
  if (view.kind === "header") {
    return headerIndex;
  }

  if (view.kind === "date") {
    return dateToIndex.get(view.date) ?? postIdToIndex.get(view.postId) ?? null;
  }

  if (view.kind === "unread") {
    return unreadIndex ?? postIdToIndex.get(view.postId) ?? null;
  }

  return postIdToIndex.get(view.postId) ?? null;
}

/** Resolves one saved semantic view into a precise local restore anchor. */
export function createRestoreConversationAnchor({
  dateToIndex,
  headerIndex,
  postIdToIndex,
  unreadIndex,
  view,
}: {
  dateToIndex: Map<number, number>;
  headerIndex: number | null;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  unreadIndex: number | null;
  view: RestorableConversationView;
}): RestoreConversationAnchor | null {
  const index = resolveConversationViewIndex({
    dateToIndex,
    headerIndex,
    postIdToIndex,
    unreadIndex,
    view,
  });

  if (index === undefined || index === null) {
    return null;
  }

  return {
    kind: "index",
    index,
    align: "start",
    offset: view.offset,
  };
}

/** Chooses the fresh-mount conversation mode from one saved view snapshot. */
export function createForumConversationMode({
  restoreView,
}: {
  restoreView: ForumConversationView | null;
}): ForumConversationMode {
  if (restoreView && restoreView.kind !== "bottom") {
    return {
      kind: "restore",
      postId: getRestoreTargetPostId(restoreView),
      view: restoreView,
    };
  }

  return { kind: "live" };
}

/** Resolves the first virtual list anchor for a fresh conversation mount. */
export function createInitialConversationAnchor({
  dateToIndex,
  existingView,
  headerIndex,
  mode,
  postIdToIndex,
  unreadIndex,
}: {
  dateToIndex: Map<number, number>;
  existingView: ForumConversationView | null;
  headerIndex: number | null;
  mode: ForumConversationMode;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  unreadIndex: number | null;
}): VirtualConversationAnchor {
  if (mode.kind !== "live") {
    if (mode.kind === "restore") {
      return (
        createRestoreConversationAnchor({
          dateToIndex,
          headerIndex,
          postIdToIndex,
          unreadIndex,
          view: mode.view,
        }) ?? { kind: "bottom" }
      );
    }

    const index = postIdToIndex.get(mode.postId);

    if (index === undefined || index === null) {
      return { kind: "bottom" };
    }

    return { kind: "index", index, align: "center" };
  }

  if (existingView?.kind === "bottom") {
    return { kind: "bottom" };
  }

  if (unreadIndex !== null) {
    return { kind: "index", index: unreadIndex, align: "center" };
  }

  return { kind: "bottom" };
}

/** Creates the first fallback snapshot for a newly mounted conversation. */
export function createInitialConversationView({
  existingView,
  items,
  mode,
  unreadIndex,
}: {
  existingView: ForumConversationView | null;
  items: VirtualItem[];
  mode: ForumConversationMode;
  unreadIndex: number | null;
}): ForumConversationView | null {
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

  if (unreadIndex === null) {
    return { kind: "bottom" };
  }

  const unreadPost = items
    .slice(unreadIndex)
    .find((item) => item.type === "post");

  if (!unreadPost || unreadPost.type !== "post") {
    return { kind: "bottom" };
  }

  return {
    kind: "unread",
    offset: 0,
    postId: unreadPost.post._id,
  };
}

/** Finds the measured item that currently starts the visible viewport. */
function findVisibleItemIndexAtOffset({
  itemCount,
  getItemOffset,
  offset,
  startIndex,
}: {
  itemCount: number;
  getItemOffset: (index: number) => number;
  offset: number;
  startIndex: number;
}) {
  if (itemCount === 0) {
    return null;
  }

  let index = Math.min(startIndex, itemCount - 1);

  while (index > 0 && getItemOffset(index) > offset) {
    index -= 1;
  }

  while (index < itemCount - 1 && getItemOffset(index + 1) <= offset) {
    index += 1;
  }

  return index;
}

/** Captures one session-restorable view from the virtualized viewport. */
function createConversationViewAtIndex({
  currentOffset,
  handle,
  index,
  items,
}: {
  currentOffset: number;
  handle: VirtualConversationHandle;
  index: number;
  items: VirtualItem[];
}): ForumConversationView | null {
  const item = items[index];

  if (!item) {
    return null;
  }

  const offset = Math.max(0, currentOffset - handle.getItemOffset(index));

  if (item.type === "header") {
    return {
      kind: "header",
      offset,
      postId: findNextPostId(items, index),
    };
  }

  if (item.type === "date") {
    const postId = findNextPostId(items, index);

    if (!postId) {
      return null;
    }

    return {
      kind: "date",
      date: item.date,
      offset,
      postId,
    };
  }

  if (item.type === "unread") {
    const postId = findNextPostId(items, index);

    if (!postId) {
      return null;
    }

    return {
      kind: "unread",
      offset,
      postId,
    };
  }

  if (item.type === "post") {
    return {
      kind: "post",
      postId: item.post._id,
      offset,
    };
  }

  return null;
}

/** Captures one session-restorable view from the virtualized viewport. */
export function captureConversationView({
  items,
  offset,
  scrollRef,
}: {
  items: VirtualItem[];
  offset?: number;
  scrollRef: RefObject<VirtualConversationHandle | null>;
}): ForumConversationView | null {
  const handle = scrollRef.current;

  if (!handle) {
    return null;
  }

  if (handle.isAtBottom()) {
    return { kind: "bottom" };
  }

  const currentOffset = offset ?? handle.getScrollOffset();
  const visibleIndex = findVisibleItemIndexAtOffset({
    itemCount: items.length,
    getItemOffset: handle.getItemOffset,
    offset: currentOffset,
    startIndex: handle.findItemIndex(currentOffset),
  });

  if (visibleIndex === null) {
    return null;
  }

  for (let index = visibleIndex; index < items.length; index += 1) {
    const view = createConversationViewAtIndex({
      currentOffset,
      handle,
      index,
      items,
    });

    if (view) {
      return view;
    }
  }

  for (let index = visibleIndex - 1; index >= 0; index -= 1) {
    const view = createConversationViewAtIndex({
      currentOffset,
      handle,
      index,
      items,
    });

    if (view) {
      return view;
    }
  }

  return null;
}
