import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { DatabaseReader } from "@repo/backend/convex/_generated/server";
import { getForumPostsAtTimestamp } from "@repo/backend/convex/classes/forums/utils/timestampPosts";

/**
 * Return whether a new read boundary is strictly later than the stored one.
 */
export async function shouldAdvanceForumReadBoundary(
  db: DatabaseReader,
  {
    existingLastReadAt,
    existingLastReadPostId,
    forumId,
    nextLastReadAt,
    nextLastReadPostId,
  }: {
    existingLastReadAt: number;
    existingLastReadPostId?: Id<"schoolClassForumPosts">;
    forumId: Id<"schoolClassForums">;
    nextLastReadAt: number;
    nextLastReadPostId?: Id<"schoolClassForumPosts">;
  }
) {
  if (nextLastReadAt > existingLastReadAt) {
    return true;
  }

  if (nextLastReadAt < existingLastReadAt) {
    return false;
  }

  if (!(nextLastReadPostId && existingLastReadPostId)) {
    return false;
  }

  if (existingLastReadPostId === nextLastReadPostId) {
    return false;
  }

  const postsAtTimestamp = await getForumPostsAtTimestamp(db, {
    forumId,
    timestamp: nextLastReadAt,
  });
  const existingIndex = postsAtTimestamp.findIndex(
    (post) => post._id === existingLastReadPostId
  );
  const nextIndex = postsAtTimestamp.findIndex(
    (post) => post._id === nextLastReadPostId
  );

  if (nextIndex < 0) {
    return false;
  }

  if (existingIndex < 0) {
    return true;
  }

  return nextIndex > existingIndex;
}

/**
 * Return whether one post falls strictly after a stored forum read boundary.
 */
export async function isPostAfterForumReadBoundary(
  db: DatabaseReader,
  {
    forumId,
    lastReadAt,
    lastReadPostId,
    postId,
    postTime,
  }: {
    forumId: Id<"schoolClassForums">;
    lastReadAt: number;
    lastReadPostId?: Id<"schoolClassForumPosts">;
    postId: Id<"schoolClassForumPosts">;
    postTime: number;
  }
) {
  if (postTime > lastReadAt) {
    return true;
  }

  if (postTime < lastReadAt || !lastReadPostId) {
    return false;
  }

  const postsAtTimestamp = await getForumPostsAtTimestamp(db, {
    forumId,
    timestamp: postTime,
  });
  const lastReadIndex = postsAtTimestamp.findIndex(
    (timestampPost) => timestampPost._id === lastReadPostId
  );
  const postIndex = postsAtTimestamp.findIndex(
    (timestampPost) => timestampPost._id === postId
  );

  if (postIndex < 0) {
    return false;
  }

  if (lastReadIndex < 0) {
    return true;
  }

  return postIndex > lastReadIndex;
}
