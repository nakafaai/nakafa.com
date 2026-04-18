"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMemo } from "react";
import type {
  Forum,
  ForumPost,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";

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
  // Calculate unread info
  const { firstUnreadIndex, unreadCount } = useMemo(() => {
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
  }, [baselineLatestPostId, isDetachedMode, posts]);

  // Build virtual items
  const { dateToIndex, headerIndex, items, postIdToIndex, unreadIndex } =
    useMemo(() => {
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
        const prevDate = prevPost
          ? new Date(prevPost._creationTime).toDateString()
          : new Date(post._creationTime).toDateString();
        const currentDate = new Date(post._creationTime).toDateString();

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

        idToIndex.set(post._id, result.length);
        result.push({ type: "post", post, isFirstInGroup });
      }

      return {
        items: result,
        dateToIndex,
        headerIndex: nextHeaderIndex,
        postIdToIndex: idToIndex,
        unreadIndex: nextUnreadIndex,
      };
    }, [forum, posts, firstUnreadIndex, unreadCount, isDetachedMode]);

  return {
    dateToIndex,
    headerIndex,
    items,
    postIdToIndex,
    unreadIndex,
  };
}

export { useVirtualItems as useItems };
