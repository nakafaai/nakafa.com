import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  DEFAULT_FORUM_POST_WINDOW,
  MAX_FORUM_POST_WINDOW,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { ConvexError } from "convex/values";

/**
 * Resolve one public forum post window request into a bounded integer page
 * size.
 */
export function resolveForumPostWindow(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_FORUM_POST_WINDOW;
  }

  if (!Number.isInteger(limit)) {
    throw new ConvexError({
      code: "FORUM_POST_WINDOW_INVALID",
      message: "Forum post window must be an integer.",
    });
  }

  if (limit < 1 || limit > MAX_FORUM_POST_WINDOW) {
    throw new ConvexError({
      code: "FORUM_POST_WINDOW_INVALID",
      message: `Forum post window must be between 1 and ${MAX_FORUM_POST_WINDOW}.`,
    });
  }

  return limit;
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
