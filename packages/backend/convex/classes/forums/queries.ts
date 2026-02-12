import { query } from "@repo/backend/convex/_generated/server";
import {
  attachForumUsers,
  buildReactorsByEmoji,
  enrichForumPosts,
  getForumLastReadAt,
  getForumUnreadCounts,
  getMyForumReactions,
  loadForum,
  loadForumWithAccess,
} from "@repo/backend/convex/classes/forums/utils";
import { loadClass } from "@repo/backend/convex/classes/utils";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requireClassAccess } from "@repo/backend/convex/lib/helpers/class";
import { getUserMap } from "@repo/backend/convex/lib/helpers/user";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { vv } from "@/convex/lib/validators/vv";

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
            .withIndex("classId_status_lastPostAt", (q) =>
              q.eq("classId", classId)
            )
            .order("desc")
            .paginate(paginationOpts);

    const forumIds = forumsPage.page.map((f) => f._id);
    const [userMap, myReactionsMap, unreadCountMap] = await Promise.all([
      attachForumUsers(ctx, forumsPage.page),
      getMyForumReactions(ctx, forumIds, user.appUser._id),
      getForumUnreadCounts(ctx, classId, user.appUser._id, forumsPage.page),
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

    const [, reactions, lastReadAt] = await Promise.all([
      requireClassAccess(ctx, forum.classId, forum.schoolId, currentUserId),
      ctx.db
        .query("schoolClassForumReactions")
        .withIndex("forumId_userId_emoji", (q) => q.eq("forumId", forum._id))
        .collect(),
      getForumLastReadAt(ctx, forum._id, currentUserId),
    ]);

    const reactorUserIds = reactions.map((r) => r.userId);
    const userMap = await getUserMap(ctx, [forum.createdBy, ...reactorUserIds]);

    const myReactions = reactions
      .filter((r) => r.userId === currentUserId)
      .map((r) => r.emoji);

    const reactorsByEmoji = buildReactorsByEmoji(reactions, userMap);

    return {
      ...forum,
      user: userMap.get(forum.createdBy) ?? null,
      myReactions,
      reactionUsers: forum.reactionCounts.map(({ emoji, count }) => ({
        emoji,
        count,
        reactors: reactorsByEmoji.get(emoji) ?? [],
      })),
      lastReadAt,
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
    const { forumId, targetPostId, limit = 15 } = args;

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

    const [postsBefore, postsAfter] = await Promise.all([
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("forumId", (q) =>
          q.eq("forumId", forumId).lt("_creationTime", targetTime)
        )
        .order("desc")
        .take(limit),
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("forumId", (q) =>
          q.eq("forumId", forumId).gt("_creationTime", targetTime)
        )
        .order("asc")
        .take(limit),
    ]);

    const allPosts = [...postsBefore.reverse(), targetPost, ...postsAfter];
    const hasMoreBefore = postsBefore.length === limit;
    const hasMoreAfter = postsAfter.length === limit;

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
      targetIndex: postsBefore.length,
      hasMoreBefore,
      hasMoreAfter,
      oldestTime: firstPost?._creationTime ?? targetTime,
      newestTime: lastPost?._creationTime ?? targetTime,
    };
  },
});

export const getForumPostsOlder = query({
  args: {
    forumId: vv.id("schoolClassForums"),
    beforeTime: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { forumId, beforeTime, limit = 15 } = args;

    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, forumId, user.appUser._id);

    const posts = await ctx.db
      .query("schoolClassForumPosts")
      .withIndex("forumId", (q) =>
        q.eq("forumId", forumId).lt("_creationTime", beforeTime)
      )
      .order("desc")
      .take(limit);

    const hasMore = posts.length === limit;
    const orderedPosts = [...posts].reverse();

    const enrichedPosts = await enrichForumPosts(
      ctx,
      orderedPosts,
      user.appUser._id
    );

    return {
      posts: enrichedPosts,
      hasMore,
      oldestTime: orderedPosts[0]?._creationTime,
    };
  },
});

export const getForumPostsNewer = query({
  args: {
    forumId: vv.id("schoolClassForums"),
    afterTime: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { forumId, afterTime, limit = 15 } = args;

    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, forumId, user.appUser._id);

    const posts = await ctx.db
      .query("schoolClassForumPosts")
      .withIndex("forumId", (q) =>
        q.eq("forumId", forumId).gt("_creationTime", afterTime)
      )
      .order("asc")
      .take(limit);

    const hasMore = posts.length === limit;
    const enrichedPosts = await enrichForumPosts(ctx, posts, user.appUser._id);

    const lastIdx = posts.length - 1;
    const newestPost = lastIdx >= 0 ? posts[lastIdx] : undefined;

    return {
      posts: enrichedPosts,
      hasMore,
      newestTime: newestPost?._creationTime,
    };
  },
});
