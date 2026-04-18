import { query } from "@repo/backend/convex/_generated/server";
import { loadForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { enrichForumPosts } from "@repo/backend/convex/classes/forums/utils/posts";
import {
  loadForumBoundaryPost,
  resolveForumPostWindow,
} from "@repo/backend/convex/classes/forums/utils/windowing";
import { forumPostsOlderResultValidator } from "@repo/backend/convex/classes/forums/validators";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Get older posts before one post boundary.
 */
export const getForumPostsOlder = query({
  args: {
    beforePostId: vv.id("schoolClassForumPosts"),
    forumId: vv.id("schoolClassForums"),
    limit: v.optional(v.number()),
  },
  returns: forumPostsOlderResultValidator,
  handler: async (ctx, args) => {
    const limit = resolveForumPostWindow(args.limit);
    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, args.forumId, user.appUser._id);

    const boundaryPost = await loadForumBoundaryPost(ctx, {
      forumId: args.forumId,
      postId: args.beforePostId,
    });
    const olderPostsDesc = await ctx.db
      .query("schoolClassForumPosts")
      .withIndex("by_forumId_and_sequence", (q) =>
        q.eq("forumId", args.forumId).lt("sequence", boundaryPost.sequence)
      )
      .order("desc")
      .take(limit + 1);
    const visibleOlderPosts = olderPostsDesc.slice(0, limit).reverse();

    return {
      hasMore: olderPostsDesc.length > limit,
      oldestPostId: visibleOlderPosts[0]?._id ?? null,
      posts: await enrichForumPosts(ctx, visibleOlderPosts, user.appUser._id),
    };
  },
});
