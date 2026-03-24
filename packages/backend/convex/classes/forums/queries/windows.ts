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
 * Get a post window around a target post.
 */
export const getForumPostsAround = query({
  args: {
    forumId: vv.id("schoolClassForums"),
    limit: v.optional(v.number()),
    targetPostId: vv.id("schoolClassForumPosts"),
  },
  handler: async (ctx, args) => {
    const limit = clampForumPostWindow(args.limit);
    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, args.forumId, user.appUser._id);

    const targetPost = await loadForumBoundaryPost(ctx, {
      forumId: args.forumId,
      postId: args.targetPostId,
    });

    const [postsAtTargetTime, olderPosts, newerPosts] = await Promise.all([
      getForumPostsAtTimestamp(ctx.db, {
        forumId: args.forumId,
        timestamp: targetPost._creationTime,
      }),
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("forumId", (q) =>
          q
            .eq("forumId", args.forumId)
            .lt("_creationTime", targetPost._creationTime)
        )
        .order("desc")
        .take(limit + 1),
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("forumId", (q) =>
          q
            .eq("forumId", args.forumId)
            .gt("_creationTime", targetPost._creationTime)
        )
        .order("asc")
        .take(limit + 1),
    ]);

    const targetIndex = getBoundaryPostIndex(
      postsAtTargetTime,
      args.targetPostId
    );
    const sameTimePostsBefore = postsAtTargetTime.slice(0, targetIndex);
    const sameTimePostsAfter = postsAtTargetTime.slice(targetIndex + 1);
    const visibleSameTimePostsBefore = sameTimePostsBefore.slice(-limit);
    const visibleSameTimePostsAfter = sameTimePostsAfter.slice(0, limit);
    const remainingOlderSlots = limit - visibleSameTimePostsBefore.length;
    const remainingNewerSlots = limit - visibleSameTimePostsAfter.length;
    const visibleOlderPosts = olderPosts
      .slice(0, remainingOlderSlots)
      .reverse();
    const visibleNewerPosts = newerPosts.slice(0, remainingNewerSlots);
    const visiblePostsBefore = [
      ...visibleOlderPosts,
      ...visibleSameTimePostsBefore,
    ];
    const visiblePostsAfter = [
      ...visibleSameTimePostsAfter,
      ...visibleNewerPosts,
    ];
    const posts = [...visiblePostsBefore, targetPost, ...visiblePostsAfter];

    return {
      hasMoreAfter:
        sameTimePostsAfter.length > visibleSameTimePostsAfter.length ||
        newerPosts.length > remainingNewerSlots,
      hasMoreBefore:
        sameTimePostsBefore.length > visibleSameTimePostsBefore.length ||
        olderPosts.length > remainingOlderSlots,
      newestPostId: posts.at(-1)?._id ?? args.targetPostId,
      oldestPostId: posts[0]?._id ?? args.targetPostId,
      posts: await enrichForumPosts(ctx, posts, user.appUser._id),
      targetIndex: visiblePostsBefore.length,
    };
  },
});

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
        .withIndex("forumId", (q) =>
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
        .withIndex("forumId", (q) =>
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
