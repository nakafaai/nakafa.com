import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  VIRTUAL_CONVERSATION_BOTTOM_THRESHOLD,
  type VirtualConversationAnchor,
  type VirtualConversationHandle,
} from "@repo/design-system/components/ui/virtual-conversation";
import type { RefObject } from "react";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import type { ForumConversationView } from "@/lib/store/forum";

const bottomThreshold = VIRTUAL_CONVERSATION_BOTTOM_THRESHOLD;

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
      view: Extract<ForumConversationView, { kind: "post" }>;
    };

/** Chooses the fresh-mount conversation mode from one saved view snapshot. */
export function createForumConversationMode({
  restoreView,
}: {
  restoreView: ForumConversationView | null;
}): ForumConversationMode {
  if (restoreView?.kind === "post") {
    return { kind: "restore", postId: restoreView.postId, view: restoreView };
  }

  return { kind: "live" };
}

/** Resolves the first virtual list anchor for a fresh conversation mount. */
export function createInitialConversationAnchor({
  existingView,
  mode,
  postIdToIndex,
  unreadIndex,
}: {
  existingView: ForumConversationView | null;
  mode: ForumConversationMode;
  postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
  unreadIndex: number | null;
}): VirtualConversationAnchor {
  if (mode.kind !== "live") {
    const index = postIdToIndex.get(mode.postId);

    if (index === undefined) {
      return { kind: "bottom" };
    }

    if (mode.kind === "restore") {
      return {
        kind: "index",
        index,
        align: "start",
        offset: mode.view.offset,
      };
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
    kind: "post",
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

  if (handle.getDistanceFromBottom() <= bottomThreshold) {
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
    const item = items[index];

    if (item.type !== "post") {
      continue;
    }

    return {
      kind: "post",
      postId: item.post._id,
      offset: Math.max(0, currentOffset - handle.getItemOffset(index)),
    };
  }

  for (let index = visibleIndex - 1; index >= 0; index -= 1) {
    const item = items[index];

    if (item.type !== "post") {
      continue;
    }

    return {
      kind: "post",
      postId: item.post._id,
      offset: Math.max(0, currentOffset - handle.getItemOffset(index)),
    };
  }

  return null;
}
