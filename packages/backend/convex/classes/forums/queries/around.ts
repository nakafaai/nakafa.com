import { query } from "@repo/backend/convex/_generated/server";
import { loadForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { enrichForumPosts } from "@repo/backend/convex/classes/forums/utils/posts";
import {
  loadForumBoundaryPost,
  resolveForumPostWindow,
} from "@repo/backend/convex/classes/forums/utils/windowing";
import { forumPostsAroundResultValidator } from "@repo/backend/convex/classes/forums/validators";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Get a post window around a target post.
 */
export const getForumPostsAround = query({
  args: {
    forumId: vv.id("schoolClassForums"),
    limit: v.optional(v.number()),
    targetPostId: vv.id("schoolClassForumPosts"),
  },
  returns: forumPostsAroundResultValidator,
  handler: async (ctx, args) => {
    const limit = resolveForumPostWindow(args.limit);
    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, args.forumId, user.appUser._id);

    const targetPost = await loadForumBoundaryPost(ctx, {
      forumId: args.forumId,
      postId: args.targetPostId,
    });
    const [olderPostsDesc, newerPostsAsc] = await Promise.all([
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("by_forumId_and_sequence", (q) =>
          q.eq("forumId", args.forumId).lt("sequence", targetPost.sequence)
        )
        .order("desc")
        .take(limit),
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("by_forumId_and_sequence", (q) =>
          q.eq("forumId", args.forumId).gt("sequence", targetPost.sequence)
        )
        .order("asc")
        .take(limit),
    ]);

    const preferredOlderCount = Math.floor(limit / 2);
    const preferredNewerCount = limit - preferredOlderCount - 1;
    let visibleOlderCount = Math.min(
      olderPostsDesc.length,
      preferredOlderCount
    );
    let visibleNewerCount = Math.min(newerPostsAsc.length, preferredNewerCount);
    const remainingSlots = limit - (visibleOlderCount + visibleNewerCount + 1);

    if (remainingSlots > 0 && visibleOlderCount < preferredOlderCount) {
      visibleNewerCount = Math.min(
        newerPostsAsc.length,
        visibleNewerCount + remainingSlots
      );
    }

    if (remainingSlots > 0 && visibleOlderCount >= preferredOlderCount) {
      visibleOlderCount = Math.min(
        olderPostsDesc.length,
        visibleOlderCount + remainingSlots
      );
    }

    const visibleOlderPosts = olderPostsDesc
      .slice(0, visibleOlderCount)
      .reverse();
    const visibleNewerPosts = newerPostsAsc.slice(0, visibleNewerCount);
    const posts = [...visibleOlderPosts, targetPost, ...visibleNewerPosts];

    return {
      hasMoreAfter: newerPostsAsc.length > visibleNewerCount,
      hasMoreBefore: olderPostsDesc.length > visibleOlderCount,
      newestPostId: posts.at(-1)?._id ?? args.targetPostId,
      oldestPostId: posts[0]?._id ?? args.targetPostId,
      posts: await enrichForumPosts(ctx, posts, user.appUser._id),
      targetIndex: visibleOlderPosts.length,
    };
  },
});
