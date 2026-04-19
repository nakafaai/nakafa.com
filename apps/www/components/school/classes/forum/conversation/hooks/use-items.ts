import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMemo } from "react";
import type {
  Forum,
  ForumPost,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";

/** Calculates unread boundaries for one live forum transcript window. */
function getUnreadWindow({
  baselineLatestPostId,
  isDetachedMode,
  posts,
}: {
  baselineLatestPostId: Id<"schoolClassForumPosts"> | null;
  isDetachedMode: boolean;
  posts: ForumPost[];
}) {
  if (isDetachedMode) {
    return { firstUnreadIndex: -1, unreadCount: 0 };
  }

  let firstIdx = -1;
  let count = 0;
  let passedBaselineLatestPost = baselineLatestPostId === null;

  for (const [i, post] of posts.entries()) {
    const isUnread = !passedBaselineLatestPost && post.isUnread === true;

    if (isUnread) {
      if (firstIdx === -1) {
        firstIdx = i;
      }
      count += 1;
    }

    if (post._id === baselineLatestPostId) {
      passedBaselineLatestPost = true;
    }
  }

  return { firstUnreadIndex: firstIdx, unreadCount: count };
}

/** Builds the semantic virtual transcript items for one forum conversation. */
export function buildVirtualItems({
  firstUnreadIndex,
  forum,
  isDetachedMode,
  posts,
  unreadCount,
}: {
  firstUnreadIndex: number;
  forum: Forum | undefined;
  isDetachedMode: boolean;
  posts: ForumPost[];
  unreadCount: number;
}) {
  const result: VirtualItem[] = [];
  const dateToIndex = new Map<number, number>();
  let nextHeaderIndex: number | null = null;
  const idToIndex = new Map<Id<"schoolClassForumPosts">, number>();
  let nextUnreadIndex: number | null = null;

  if (forum) {
    nextHeaderIndex = result.length;
    result.push({ type: "header", forum });
  }

  for (const [index, post] of posts.entries()) {
    const prevPost = posts[index - 1];
    const nextPost = posts[index + 1];
    const prevMinute = prevPost
      ? Math.floor(prevPost._creationTime / 60_000)
      : null;
    const currentMinute = Math.floor(post._creationTime / 60_000);
    const prevDate = prevPost
      ? new Date(prevPost._creationTime).toDateString()
      : new Date(post._creationTime).toDateString();
    const currentDate = new Date(post._creationTime).toDateString();
    const nextDate = nextPost
      ? new Date(nextPost._creationTime).toDateString()
      : currentDate;

    if (currentDate !== prevDate) {
      dateToIndex.set(post._creationTime, result.length);
      result.push({ type: "date", date: post._creationTime });
    }

    if (!isDetachedMode && index === firstUnreadIndex) {
      result.push({ type: "unread", count: unreadCount });
      nextUnreadIndex = result.length - 1;
    }

    const isFirstInGroup =
      currentDate !== prevDate ||
      !prevPost ||
      prevPost.createdBy !== post.createdBy;
    const isLastInGroup =
      currentDate !== nextDate ||
      !nextPost ||
      nextPost.createdBy !== post.createdBy;
    const showContinuationTime =
      !isFirstInGroup && prevMinute !== currentMinute;

    idToIndex.set(post._id, result.length);
    result.push({
      type: "post",
      post,
      isFirstInGroup,
      isLastInGroup,
      showContinuationTime,
    });
  }

  return {
    items: result,
    dateToIndex,
    headerIndex: nextHeaderIndex,
    postIdToIndex: idToIndex,
    unreadIndex: nextUnreadIndex,
  };
}

/**
 * Builds virtual list items from posts with:
 * - Forum header
 * - Date separators
 * - Unread separator
 * - Post items with grouping
 */
export function useVirtualItems({
  baselineLatestPostId,
  forum,
  posts,
  isDetachedMode,
}: {
  baselineLatestPostId: Id<"schoolClassForumPosts"> | null;
  forum: Forum | undefined;
  isDetachedMode: boolean;
  posts: ForumPost[];
}) {
  const { firstUnreadIndex, unreadCount } = useMemo(
    () =>
      getUnreadWindow({
        baselineLatestPostId,
        isDetachedMode,
        posts,
      }),
    [baselineLatestPostId, isDetachedMode, posts]
  );

  const { dateToIndex, headerIndex, items, postIdToIndex, unreadIndex } =
    useMemo(
      () =>
        buildVirtualItems({
          firstUnreadIndex,
          forum,
          isDetachedMode,
          posts,
          unreadCount,
        }),
      [forum, posts, firstUnreadIndex, unreadCount, isDetachedMode]
    );

  return {
    dateToIndex,
    headerIndex,
    items,
    postIdToIndex,
    unreadIndex,
  };
}

export { useVirtualItems as useItems };
