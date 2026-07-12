import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

type ReadablePost = Pick<ForumPost, "_id" | "isUnread" | "sequence">;

export interface ForumReadState<T> {
  posts: T[];
  unreadCount: number;
}

/** Mark loaded posts through one concrete sequence boundary as read. */
export function markTranscriptRead<T extends ReadablePost>(
  posts: readonly T[],
  lastReadPostId: Id<"schoolClassForumPosts">
): ForumReadState<T> | null {
  const boundary = posts.find((post) => post._id === lastReadPostId);

  if (!boundary) {
    return null;
  }

  const nextPosts = posts.map((post) => {
    if (!post.isUnread || post.sequence > boundary.sequence) {
      return post;
    }

    return { ...post, isUnread: false };
  });
  const unreadCount = nextPosts.reduce(
    (count, post) => count + (post.isUnread ? 1 : 0),
    0
  );

  return { posts: nextPosts, unreadCount };
}
