import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import {
  attachForumUsers,
  enrichForumPosts,
  getForumReactionPreviews,
  getForumReadState,
  getForumUnreadCounts,
  getMyForumReactions,
  loadForum,
  loadForumWithAccess,
} from "@repo/backend/convex/classes/forums/utils";
import { loadClass } from "@repo/backend/convex/classes/utils";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requireClassAccess } from "@repo/backend/convex/lib/helpers/class";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

const MAX_FORUM_POST_WINDOW = 50;
const MAX_FORUM_BOUNDARY_POSTS = MAX_FORUM_POST_WINDOW * 4;

function clampForumPostWindow(limit: number | undefined) {
  if (limit === undefined) {
    return 15;
  }

  return Math.min(Math.max(limit, 1), MAX_FORUM_POST_WINDOW);
}

function getBoundaryPostIndex(
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
 * Loads posts sharing one forum timestamp in a bounded batch.
 */
async function getPostsAtBoundaryTime(
  ctx: QueryCtx,
  {
    forumId,
    timestamp,
  }: {
    forumId: Id<"schoolClassForums">;
    timestamp: number;
  }
) {
  const posts = await ctx.db
    .query("schoolClassForumPosts")
    .withIndex("forumId", (q) =>
      q.eq("forumId", forumId).eq("_creationTime", timestamp)
    )
    .order("asc")
    .take(MAX_FORUM_BOUNDARY_POSTS + 1);

  if (posts.length > MAX_FORUM_BOUNDARY_POSTS) {
    throw new ConvexError({
      code: "FORUM_BOUNDARY_WINDOW_LIMIT_EXCEEDED",
      message: "Too many forum posts share the same creation time.",
    });
  }

  return posts;
}

export const getForums = query({
  args: {
    classId: vv.id("schoolClasses"),
    q: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { classId, q: searchQuery, paginationOpts } = args;

    const user = await requireAuth(ctx);
    const classData = await loadClass(ctx, classId);
    await requireClassAccess(
      ctx,
      classId,
      classData.schoolId,
      user.appUser._id
    );

    const forumsPage =
      searchQuery && searchQuery.trim().length > 0
        ? await ctx.db
            .query("schoolClassForums")
            .withSearchIndex("search_title", (q) =>
              q.search("title", searchQuery).eq("classId", classId)
            )
            .paginate(paginationOpts)
        : await ctx.db
            .query("schoolClassForums")
            .withIndex("by_classId_and_lastPostAt", (q) =>
              q.eq("classId", classId)
            )
            .order("desc")
            .paginate(paginationOpts);

    const forumIds = forumsPage.page.map((f) => f._id);
    const [userMap, myReactionsMap, unreadCountMap] = await Promise.all([
      attachForumUsers(ctx, forumsPage.page),
      getMyForumReactions(ctx, forumIds, user.appUser._id),
      getForumUnreadCounts(ctx, user.appUser._id, forumsPage.page),
    ]);

    return {
      ...forumsPage,
      page: forumsPage.page.map((forum) => ({
        ...forum,
        user: userMap.get(forum.createdBy) ?? null,
        myReactions: myReactionsMap.get(forum._id) ?? [],
        unreadCount: unreadCountMap.get(forum._id) ?? 0,
      })),
    };
  },
});

export const getForum = query({
  args: {
    forumId: vv.id("schoolClassForums"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const currentUserId = user.appUser._id;

    const forum = await loadForum(ctx, args.forumId);
    const [, forumUserMap, reactionPreviews, myReactionsByForum, readState] =
      await Promise.all([
        requireClassAccess(ctx, forum.classId, forum.schoolId, currentUserId),
        getUserMap(ctx, [forum.createdBy]),
        getForumReactionPreviews(ctx, forum),
        getMyForumReactions(ctx, [forum._id], currentUserId),
        getForumReadState(ctx, forum._id, currentUserId),
      ]);

    return {
      ...forum,
      user: forumUserMap.get(forum.createdBy) ?? null,
      myReactions: myReactionsByForum.get(forum._id) ?? [],
      reactionUsers: forum.reactionCounts.map(({ emoji, count }) => ({
        emoji,
        count,
        reactors: reactionPreviews.get(emoji) ?? [],
      })),
      lastReadAt: readState.lastReadAt,
      lastReadPostId: readState.lastReadPostId,
    };
  },
});

export const getForumPosts = query({
  args: {
    forumId: vv.id("schoolClassForums"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { forumId, paginationOpts } = args;

    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, forumId, user.appUser._id);

    const postsPage = await ctx.db
      .query("schoolClassForumPosts")
      .withIndex("forumId", (idx) => idx.eq("forumId", forumId))
      .order("desc")
      .paginate(paginationOpts);

    const enrichedPosts = await enrichForumPosts(
      ctx,
      postsPage.page,
      user.appUser._id
    );

    return {
      ...postsPage,
      page: enrichedPosts,
    };
  },
});

export const getForumPostsAround = query({
  args: {
    forumId: vv.id("schoolClassForums"),
    targetPostId: vv.id("schoolClassForumPosts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { forumId, targetPostId } = args;
    const limit = clampForumPostWindow(args.limit);

    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, forumId, user.appUser._id);

    const targetPost = await ctx.db.get("schoolClassForumPosts", targetPostId);
    if (!targetPost || targetPost.forumId !== forumId) {
      throw new ConvexError({
        code: "POST_NOT_FOUND",
        message: `Post not found for postId: ${targetPostId}`,
      });
    }

    const targetTime = targetPost._creationTime;

    const [postsAtTargetTime, olderPosts, newerPosts] = await Promise.all([
      getPostsAtBoundaryTime(ctx, {
        forumId,
        timestamp: targetTime,
      }),
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("forumId", (q) =>
          q.eq("forumId", forumId).lt("_creationTime", targetTime)
        )
        .order("desc")
        .take(limit + 1),
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("forumId", (q) =>
          q.eq("forumId", forumId).gt("_creationTime", targetTime)
        )
        .order("asc")
        .take(limit + 1),
    ]);

    const targetIndex = getBoundaryPostIndex(postsAtTargetTime, targetPostId);
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
    const hasMoreBefore =
      sameTimePostsBefore.length > visibleSameTimePostsBefore.length ||
      olderPosts.length > remainingOlderSlots;
    const hasMoreAfter =
      sameTimePostsAfter.length > visibleSameTimePostsAfter.length ||
      newerPosts.length > remainingNewerSlots;
    const visiblePostsBefore = [
      ...visibleOlderPosts,
      ...visibleSameTimePostsBefore,
    ];
    const visiblePostsAfter = [
      ...visibleSameTimePostsAfter,
      ...visibleNewerPosts,
    ];
    const allPosts = [...visiblePostsBefore, targetPost, ...visiblePostsAfter];

    const enrichedPosts = await enrichForumPosts(
      ctx,
      allPosts,
      user.appUser._id
    );

    const firstPost = allPosts[0];
    const lastPostIdx = allPosts.length - 1;
    const lastPost = lastPostIdx >= 0 ? allPosts[lastPostIdx] : undefined;

    return {
      posts: enrichedPosts,
      targetIndex: visiblePostsBefore.length,
      hasMoreBefore,
      hasMoreAfter,
      oldestPostId: firstPost?._id ?? targetPostId,
      newestPostId: lastPost?._id ?? targetPostId,
    };
  },
});

export const getForumPostsOlder = query({
  args: {
    forumId: vv.id("schoolClassForums"),
    beforePostId: vv.id("schoolClassForumPosts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { forumId, beforePostId } = args;
    const limit = clampForumPostWindow(args.limit);

    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, forumId, user.appUser._id);

    const boundaryPost = await ctx.db.get(
      "schoolClassForumPosts",
      beforePostId
    );

    if (!boundaryPost || boundaryPost.forumId !== forumId) {
      throw new ConvexError({
        code: "POST_NOT_FOUND",
        message: `Post not found for postId: ${beforePostId}`,
      });
    }

    const [postsAtBoundaryTime, olderPosts] = await Promise.all([
      getPostsAtBoundaryTime(ctx, {
        forumId,
        timestamp: boundaryPost._creationTime,
      }),
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("forumId", (q) =>
          q
            .eq("forumId", forumId)
            .lt("_creationTime", boundaryPost._creationTime)
        )
        .order("desc")
        .take(limit + 1),
    ]);

    const boundaryIndex = getBoundaryPostIndex(
      postsAtBoundaryTime,
      beforePostId
    );
    const sameTimeOlderPosts = postsAtBoundaryTime.slice(0, boundaryIndex);
    const visibleSameTimeOlderPosts = sameTimeOlderPosts.slice(-limit);
    const remainingOlderSlots = limit - visibleSameTimeOlderPosts.length;
    const visibleOlderPosts = olderPosts
      .slice(0, remainingOlderSlots)
      .reverse();
    const orderedPosts = [...visibleOlderPosts, ...visibleSameTimeOlderPosts];
    const hasMore =
      sameTimeOlderPosts.length > visibleSameTimeOlderPosts.length ||
      olderPosts.length > remainingOlderSlots;

    const enrichedPosts = await enrichForumPosts(
      ctx,
      orderedPosts,
      user.appUser._id
    );

    return {
      posts: enrichedPosts,
      hasMore,
      oldestPostId: orderedPosts[0]?._id,
    };
  },
});

export const getForumPostsNewer = query({
  args: {
    forumId: vv.id("schoolClassForums"),
    afterPostId: vv.id("schoolClassForumPosts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { forumId, afterPostId } = args;
    const limit = clampForumPostWindow(args.limit);

    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, forumId, user.appUser._id);

    const boundaryPost = await ctx.db.get("schoolClassForumPosts", afterPostId);

    if (!boundaryPost || boundaryPost.forumId !== forumId) {
      throw new ConvexError({
        code: "POST_NOT_FOUND",
        message: `Post not found for postId: ${afterPostId}`,
      });
    }

    const [postsAtBoundaryTime, newerPosts] = await Promise.all([
      getPostsAtBoundaryTime(ctx, {
        forumId,
        timestamp: boundaryPost._creationTime,
      }),
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("forumId", (q) =>
          q
            .eq("forumId", forumId)
            .gt("_creationTime", boundaryPost._creationTime)
        )
        .order("asc")
        .take(limit + 1),
    ]);

    const boundaryIndex = getBoundaryPostIndex(
      postsAtBoundaryTime,
      afterPostId
    );
    const sameTimeNewerPosts = postsAtBoundaryTime.slice(boundaryIndex + 1);
    const visibleSameTimeNewerPosts = sameTimeNewerPosts.slice(0, limit);
    const remainingNewerSlots = limit - visibleSameTimeNewerPosts.length;
    const visibleNewerPosts = newerPosts.slice(0, remainingNewerSlots);
    const visiblePosts = [...visibleSameTimeNewerPosts, ...visibleNewerPosts];
    const hasMore =
      sameTimeNewerPosts.length > visibleSameTimeNewerPosts.length ||
      newerPosts.length > remainingNewerSlots;

    const enrichedPosts = await enrichForumPosts(
      ctx,
      visiblePosts,
      user.appUser._id
    );

    const lastIdx = visiblePosts.length - 1;
    const newestPost = lastIdx >= 0 ? visiblePosts[lastIdx] : undefined;

    return {
      posts: enrichedPosts,
      hasMore,
      newestPostId: newestPost?._id,
    };
  },
});
