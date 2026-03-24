import { query } from "@repo/backend/convex/_generated/server";
import { loadForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { enrichForumPosts } from "@repo/backend/convex/classes/forums/utils/posts";
import { getForumPostsAtTimestamp } from "@repo/backend/convex/classes/forums/utils/timestampPosts";
import {
  clampForumPostWindow,
  getBoundaryPostIndex,
  loadForumBoundaryPost,
} from "@repo/backend/convex/classes/forums/utils/windowing";
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
  handler: async (ctx, args) => {
    const limit = clampForumPostWindow(args.limit);
    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, args.forumId, user.appUser._id);

    const boundaryPost = await loadForumBoundaryPost(ctx, {
      forumId: args.forumId,
      postId: args.afterPostId,
    });
    const [postsAtBoundaryTime, newerPosts] = await Promise.all([
      getForumPostsAtTimestamp(ctx.db, {
        forumId: args.forumId,
        timestamp: boundaryPost._creationTime,
      }),
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("by_forumId", (q) =>
          q
            .eq("forumId", args.forumId)
            .gt("_creationTime", boundaryPost._creationTime)
        )
        .order("asc")
        .take(limit + 1),
    ]);

    const boundaryIndex = getBoundaryPostIndex(
      postsAtBoundaryTime,
      args.afterPostId
    );
    const sameTimeNewerPosts = postsAtBoundaryTime.slice(boundaryIndex + 1);
    const visibleSameTimeNewerPosts = sameTimeNewerPosts.slice(0, limit);
    const remainingNewerSlots = limit - visibleSameTimeNewerPosts.length;
    const visibleNewerPosts = newerPosts.slice(0, remainingNewerSlots);
    const posts = [...visibleSameTimeNewerPosts, ...visibleNewerPosts];

    return {
      hasMore:
        sameTimeNewerPosts.length > visibleSameTimeNewerPosts.length ||
        newerPosts.length > remainingNewerSlots,
      newestPostId: posts.at(-1)?._id,
      posts: await enrichForumPosts(ctx, posts, user.appUser._id),
    };
  },
});
