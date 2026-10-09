import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option } from "effect";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

type ReadablePost = Pick<ForumPost, "_id" | "isUnread" | "sequence">;

/** Mark loaded posts through one concrete sequence boundary as read. */
export function markTranscriptRead<T extends ReadablePost>(
  posts: readonly T[],
  lastReadPostId: Id<"schoolClassForumPosts">
) {
  const boundary = Arr.findFirst(posts, (post) => post._id === lastReadPostId);

  if (Option.isNone(boundary)) {
    return null;
  }

  const nextPosts: T[] = Arr.map(posts, (post) => {
    if (!post.isUnread || post.sequence > boundary.value.sequence) {
      return post;
    }

    return { ...post, isUnread: false };
  });
  const unreadCount = Arr.reduce(
    nextPosts,
    0,
    (count, post) => count + (post.isUnread ? 1 : 0)
  );

  return { posts: nextPosts, unreadCount };
}
