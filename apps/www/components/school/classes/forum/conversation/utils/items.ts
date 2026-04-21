import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  Forum,
  ForumPost,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";

export interface UnreadCue {
  count: number;
  postId: Id<"schoolClassForumPosts">;
  status: "history" | "new";
}

/** Builds the semantic Virtua rows for one forum transcript window. */
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
  const items: VirtualItem[] = [];
  const postIdToIndex = new Map<Id<"schoolClassForumPosts">, number>();

  if (forum) {
    items.push({ type: "header", forum });
  }

  for (const [index, post] of posts.entries()) {
    const previousPost = posts[index - 1];
    const nextPost = posts[index + 1];
    const previousMinute = previousPost
      ? Math.floor(previousPost._creationTime / 60_000)
      : null;
    const currentMinute = Math.floor(post._creationTime / 60_000);
    const previousDate = previousPost
      ? new Date(previousPost._creationTime).toDateString()
      : new Date(post._creationTime).toDateString();
    const currentDate = new Date(post._creationTime).toDateString();
    const nextDate = nextPost
      ? new Date(nextPost._creationTime).toDateString()
      : currentDate;

    if (currentDate !== previousDate) {
      items.push({ type: "date", date: post._creationTime });
    }

    if (!isDetachedMode && unreadCue?.postId === post._id) {
      items.push({
        type: "unread",
        count: unreadCue.count,
        postId: unreadCue.postId,
        status: unreadCue.status,
      });
    }

    const isFirstInGroup =
      currentDate !== previousDate ||
      !previousPost ||
      previousPost.createdBy !== post.createdBy;
    const isLastInGroup =
      currentDate !== nextDate ||
      !nextPost ||
      nextPost.createdBy !== post.createdBy;

    postIdToIndex.set(post._id, items.length);
    items.push({
      type: "post",
      isFirstInGroup,
      isLastInGroup,
      post,
      showContinuationTime: !isFirstInGroup && previousMinute !== currentMinute,
    });
  }

  return {
    items,
    postIdToIndex,
  };
}
