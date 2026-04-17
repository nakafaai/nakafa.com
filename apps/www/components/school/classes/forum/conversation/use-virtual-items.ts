"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMemo, useRef } from "react";
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
 * - Bottom spacer
 */
export function useVirtualItems({
  forum,
  posts,
  isDetachedMode,
}: {
  forum: Forum | undefined;
  isDetachedMode: boolean;
  posts: ForumPost[];
}) {
  const initialLatestPostId = useRef<Id<"schoolClassForumPosts"> | null>(null);

  if (
    initialLatestPostId.current === null &&
    !isDetachedMode &&
    posts.length > 0
  ) {
    initialLatestPostId.current = posts.at(-1)?._id ?? null;
  }

  // Calculate unread info
  const { firstUnreadIndex, unreadCount } = useMemo(() => {
    if (isDetachedMode) {
      return { firstUnreadIndex: -1, unreadCount: 0 };
    }
    let firstIdx = -1;
    let count = 0;
    let passedInitialLatestPost = initialLatestPostId.current === null;

    for (const [i, post] of posts.entries()) {
      const isUnread = !passedInitialLatestPost && post.isUnread === true;

      if (isUnread) {
        if (firstIdx === -1) {
          firstIdx = i;
        }
        count += 1;
      }

      if (post._id === initialLatestPostId.current) {
        passedInitialLatestPost = true;
      }
    }
    return { firstUnreadIndex: firstIdx, unreadCount: count };
  }, [isDetachedMode, posts]);

  // Build virtual items
  const { items, postIdToIndex, unreadIndex } = useMemo(() => {
    const result: VirtualItem[] = [];
    const idToIndex = new Map<Id<"schoolClassForumPosts">, number>();
    let nextUnreadIndex: number | null = null;

    if (forum) {
      result.push({ type: "header", forum });
    }

    for (const [index, post] of posts.entries()) {
      const prevPost = posts[index - 1];
      const prevDate = prevPost
        ? new Date(prevPost._creationTime).toDateString()
        : new Date(post._creationTime).toDateString();
      const currentDate = new Date(post._creationTime).toDateString();

      if (currentDate !== prevDate) {
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

    result.push({ type: "spacer" });

    return {
      items: result,
      postIdToIndex: idToIndex,
      unreadIndex: nextUnreadIndex,
    };
  }, [forum, posts, firstUnreadIndex, unreadCount, isDetachedMode]);

  return {
    items,
    postIdToIndex,
    unreadIndex,
  };
}
