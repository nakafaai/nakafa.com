import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  DEFAULT_FORUM_POST_WINDOW,
  MAX_FORUM_POST_WINDOW,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { ConvexError } from "convex/values";

/**
 * Clamp forum jump-window requests to a small bounded range.
 */
export function clampForumPostWindow(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_FORUM_POST_WINDOW;
  }

  return Math.min(Math.max(limit, 1), MAX_FORUM_POST_WINDOW);
}

/**
 * Find the boundary post inside one same-timestamp forum slice.
 */
export function getBoundaryPostIndex(
  posts: Doc<"schoolClassForumPosts">[],
  boundaryPostId: Id<"schoolClassForumPosts">
) {
  const boundaryIndex = posts.findIndex((post) => post._id === boundaryPostId);

  if (boundaryIndex < 0) {
    throw new ConvexError({
      code: "POST_NOT_FOUND",
      message: "Boundary post not found.",
    });
  }

  return boundaryIndex;
}

/**
 * Load and validate one forum post boundary.
 */
export async function loadForumBoundaryPost(
  ctx: QueryCtx,
  {
    forumId,
    postId,
  }: {
    forumId: Id<"schoolClassForums">;
    postId: Id<"schoolClassForumPosts">;
  }
) {
  const post = await ctx.db.get("schoolClassForumPosts", postId);

  if (!post || post.forumId !== forumId) {
    throw new ConvexError({
      code: "POST_NOT_FOUND",
      message: `Post not found for postId: ${postId}`,
    });
  }

  return post;
}
