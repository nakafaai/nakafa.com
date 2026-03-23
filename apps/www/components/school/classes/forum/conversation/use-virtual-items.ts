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
  isJumpMode,
  targetIndex,
}: {
  forum: Forum;
  posts: ForumPost[];
  isJumpMode: boolean;
  targetIndex: number;
}) {
  const initialLatestPostId = useRef<Id<"schoolClassForumPosts"> | null>(null);

  if (initialLatestPostId.current === null && !isJumpMode && posts.length > 0) {
    initialLatestPostId.current = posts.at(-1)?._id ?? null;
  }

  // Calculate unread info
  const { firstUnreadIndex, unreadCount } = useMemo(() => {
    if (isJumpMode) {
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
  }, [posts, isJumpMode]);

  // Build virtual items
  const { items, initialScrollIndex, postIdToIndex } = useMemo(() => {
    const result: VirtualItem[] = [];
    const idToIndex = new Map<Id<"schoolClassForumPosts">, number>();
    let scrollIndex: number | "end" = isJumpMode ? 0 : "end";

    result.push({ type: "header", forum });

    for (const [index, post] of posts.entries()) {
      const prevPost = posts[index - 1];
      const prevDate = prevPost
        ? new Date(prevPost._creationTime).toDateString()
        : new Date(forum._creationTime).toDateString();
      const currentDate = new Date(post._creationTime).toDateString();

      if (currentDate !== prevDate) {
        result.push({ type: "date", date: post._creationTime });
      }

      if (!isJumpMode && index === firstUnreadIndex) {
        result.push({ type: "unread", count: unreadCount });
        scrollIndex = result.length - 1;
      }

      const isFirstInGroup =
        currentDate !== prevDate ||
        !prevPost ||
        prevPost.createdBy !== post.createdBy;

      if (isJumpMode && index === targetIndex) {
        scrollIndex = result.length;
      }

      idToIndex.set(post._id, result.length);
      result.push({ type: "post", post, isFirstInGroup });
    }

    result.push({ type: "spacer" });

    return {
      items: result,
      initialScrollIndex: scrollIndex,
      postIdToIndex: idToIndex,
    };
  }, [forum, posts, firstUnreadIndex, unreadCount, isJumpMode, targetIndex]);

  return {
    items,
    initialScrollIndex,
    postIdToIndex,
  };
}
