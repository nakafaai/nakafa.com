import { query } from "@repo/backend/convex/_generated/server";
import { loadForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { enrichForumPosts } from "@repo/backend/convex/classes/forums/utils/posts";
import {
  loadForumBoundaryPost,
  resolveForumPostWindow,
} from "@repo/backend/convex/classes/forums/utils/windowing";
import { forumPostsNewerResultValidator } from "@repo/backend/convex/classes/forums/validators";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Get newer posts after one post boundary.
 */
export const getForumPostsNewer = query({
  args: {
    afterPostId: vv.id("schoolClassForumPosts"),
    forumId: vv.id("schoolClassForums"),
    limit: v.optional(v.number()),
  },
  returns: forumPostsNewerResultValidator,
  handler: async (ctx, args) => {
    const limit = resolveForumPostWindow(args.limit);
    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, args.forumId, user.appUser._id);

    const boundaryPost = await loadForumBoundaryPost(ctx, {
      forumId: args.forumId,
      postId: args.afterPostId,
    });
    const newerPostsAsc = await ctx.db
      .query("schoolClassForumPosts")
      .withIndex("by_forumId_and_sequence", (q) =>
        q.eq("forumId", args.forumId).gt("sequence", boundaryPost.sequence)
      )
      .order("asc")
      .take(limit + 1);
    const visibleNewerPosts = newerPostsAsc.slice(0, limit);

    return {
      hasMore: newerPostsAsc.length > limit,
      newestPostId: visibleNewerPosts.at(-1)?._id ?? null,
      posts: await enrichForumPosts(ctx, visibleNewerPosts, user.appUser._id),
    };
  },
});
