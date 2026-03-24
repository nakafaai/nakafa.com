import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { DatabaseReader } from "@repo/backend/convex/_generated/server";
import { FORUM_SAME_TIMESTAMP_POST_LIMIT } from "@repo/backend/convex/classes/forums/utils/constants";
import { ConvexError } from "convex/values";

/**
 * Find one post inside a same-timestamp post slice.
 */
export function findForumPostIndexAtTimestamp(
  postsAtTimestamp: Array<{ _id: Id<"schoolClassForumPosts"> }>,
  postId: Id<"schoolClassForumPosts">
) {
  return postsAtTimestamp.findIndex((post) => post._id === postId);
}

/**
 * Return the posts strictly after one boundary post within a same-timestamp slice.
 */
export function getForumPostsAfterBoundaryAtTimestamp(
  postsAtTimestamp: Array<{
    _id: Id<"schoolClassForumPosts">;
    createdBy?: Id<"users">;
  }>,
  boundaryPostId: Id<"schoolClassForumPosts">
) {
  const boundaryIndex = findForumPostIndexAtTimestamp(
    postsAtTimestamp,
    boundaryPostId
  );

  if (boundaryIndex < 0) {
    return postsAtTimestamp;
  }

  return postsAtTimestamp.slice(boundaryIndex + 1);
}

/**
 * Load all posts in one forum sharing the same creation timestamp.
 */
export async function getForumPostsAtTimestamp(
  db: DatabaseReader,
  {
    forumId,
    timestamp,
  }: {
    forumId: Id<"schoolClassForums">;
    timestamp: number;
  }
) {
  const posts = await db
    .query("schoolClassForumPosts")
    .withIndex("forumId", (q) =>
      q.eq("forumId", forumId).eq("_creationTime", timestamp)
    )
    .order("asc")
    .take(FORUM_SAME_TIMESTAMP_POST_LIMIT + 1);

  if (posts.length > FORUM_SAME_TIMESTAMP_POST_LIMIT) {
    throw new ConvexError({
      code: "FORUM_BOUNDARY_WINDOW_LIMIT_EXCEEDED",
      message: "Too many forum posts share the same creation time.",
    });
  }

  return posts;
}
