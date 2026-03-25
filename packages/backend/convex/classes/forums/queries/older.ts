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
 * Get older posts before one post boundary.
 */
export const getForumPostsOlder = query({
  args: {
    beforePostId: vv.id("schoolClassForumPosts"),
    forumId: vv.id("schoolClassForums"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampForumPostWindow(args.limit);
    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, args.forumId, user.appUser._id);

    const boundaryPost = await loadForumBoundaryPost(ctx, {
      forumId: args.forumId,
      postId: args.beforePostId,
    });
    const [postsAtBoundaryTime, olderPosts] = await Promise.all([
      getForumPostsAtTimestamp(ctx.db, {
        forumId: args.forumId,
        timestamp: boundaryPost._creationTime,
      }),
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("by_forumId", (q) =>
          q
            .eq("forumId", args.forumId)
            .lt("_creationTime", boundaryPost._creationTime)
        )
        .order("desc")
        .take(limit + 1),
    ]);

    const boundaryIndex = getBoundaryPostIndex(
      postsAtBoundaryTime,
      args.beforePostId
    );
    const sameTimeOlderPosts = postsAtBoundaryTime.slice(0, boundaryIndex);
    const visibleSameTimeOlderPosts = sameTimeOlderPosts.slice(-limit);
    const remainingOlderSlots = limit - visibleSameTimeOlderPosts.length;
    const visibleOlderPosts = olderPosts
      .slice(0, remainingOlderSlots)
      .reverse();
    const posts = [...visibleOlderPosts, ...visibleSameTimeOlderPosts];

    return {
      hasMore:
        sameTimeOlderPosts.length > visibleSameTimeOlderPosts.length ||
        olderPosts.length > remainingOlderSlots,
      oldestPostId: posts[0]?._id,
      posts: await enrichForumPosts(ctx, posts, user.appUser._id),
    };
  },
});
