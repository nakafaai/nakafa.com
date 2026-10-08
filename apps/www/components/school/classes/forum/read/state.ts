import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

type ReadablePost = Pick<ForumPost, "_id" | "isUnread" | "sequence">;

/** Mark loaded posts through one concrete sequence boundary as read. */
export function markTranscriptRead<T extends ReadablePost>(
  posts: readonly T[],
  lastReadPostId: Id<"schoolClassForumPosts">
) {
  const boundary = posts.find((post) => post._id === lastReadPostId);

  if (!boundary) {
    return null;
  }

  const nextPosts: T[] = posts.map((post) => {
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

/** Loaded posts and unread count after one read boundary is applied. */
export type ForumReadState<T extends ReadablePost> = NonNullable<
  ReturnType<typeof markTranscriptRead<T>>
>;
