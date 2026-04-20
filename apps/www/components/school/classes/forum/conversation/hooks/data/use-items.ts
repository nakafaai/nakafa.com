import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMemo } from "react";
import type { UnreadCue } from "@/components/school/classes/forum/conversation/hooks/data/use-unread";
import type {
  Forum,
  ForumPost,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";

/** Builds the semantic virtual transcript items for one forum conversation. */
export function buildVirtualItems({
  forum,
  isDetachedMode,
  posts,
  unreadCue,
}: {
  forum: Forum | undefined;
  isDetachedMode: boolean;
  posts: ForumPost[];
  unreadCue: UnreadCue | null;
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

    if (!isDetachedMode && unreadCue?.postId === post._id) {
      result.push({
        type: "unread",
        count: unreadCue.count,
        postId: unreadCue.postId,
        status: unreadCue.status,
      });
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

/** Memoizes the semantic transcript items for the current post window. */
export function useItems({
  forum,
  posts,
  isDetachedMode,
  unreadCue,
}: {
  forum: Forum | undefined;
  isDetachedMode: boolean;
  posts: ForumPost[];
  unreadCue: UnreadCue | null;
}) {
  const { dateToIndex, headerIndex, items, postIdToIndex, unreadIndex } =
    useMemo(
      () =>
        buildVirtualItems({
          forum,
          isDetachedMode,
          posts,
          unreadCue,
        }),
      [forum, isDetachedMode, posts, unreadCue]
    );

  return {
    dateToIndex,
    headerIndex,
    items,
    postIdToIndex,
    unreadIndex,
  };
}
