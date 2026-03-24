import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { DatabaseReader } from "@repo/backend/convex/_generated/server";
import { getForumPostsAtTimestamp } from "@repo/backend/convex/classes/forums/utils/timestampPosts";

/**
 * Compare two post ids inside one same-timestamp forum slice.
 */
export function isPostAfterBoundaryInTimestamp(
  postsAtTimestamp: Array<{ _id: Id<"schoolClassForumPosts"> }>,
  {
    boundaryPostId,
    postId,
  }: {
    boundaryPostId: Id<"schoolClassForumPosts">;
    postId: Id<"schoolClassForumPosts">;
  }
) {
  const boundaryIndex = postsAtTimestamp.findIndex(
    (post) => post._id === boundaryPostId
  );
  const postIndex = postsAtTimestamp.findIndex((post) => post._id === postId);

  if (postIndex < 0) {
    return false;
  }

  if (boundaryIndex < 0) {
    return true;
  }

  return postIndex > boundaryIndex;
}

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

  return isPostAfterBoundaryInTimestamp(postsAtTimestamp, {
    boundaryPostId: existingLastReadPostId,
    postId: nextLastReadPostId,
  });
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

  return isPostAfterBoundaryInTimestamp(postsAtTimestamp, {
    boundaryPostId: lastReadPostId,
    postId,
  });
}
