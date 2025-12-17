import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import {
  checkClassAccess,
  requireAuth,
  requireClassAccess,
} from "../lib/authHelpers";
import { getUserMap } from "../lib/userHelpers";
import {
  attachForumUsers,
  buildReactorsByEmoji,
  enrichForumPosts,
  getForumLastReadAt,
  getForumUnreadCounts,
  getMyForumReactions,
  loadClassWithAccess,
  loadForum,
  loadForumWithAccess,
} from "./utils";

/**
 * Get all classes for a school with optional search and filtering.
 * Supports full-text search by name and filtering by archived status and visibility.
 * By default, returns both public and private classes.
 */
export const getClasses = query({
  args: {
    schoolId: v.id("schools"),
    q: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
    visibility: v.optional(v.union(v.literal("private"), v.literal("public"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const {
      schoolId,
      q: searchQuery,
      isArchived,
      visibility,
      paginationOpts,
    } = args;

    // If search query is provided and not empty, use full-text search
    if (searchQuery && searchQuery.trim().length > 0) {
      return await ctx.db
        .query("schoolClasses")
        .withSearchIndex("search_name", (q) => {
          let builder = q.search("name", searchQuery).eq("schoolId", schoolId);
          if (isArchived !== undefined) {
            builder = builder.eq("isArchived", isArchived);
          }
          if (visibility !== undefined) {
            builder = builder.eq("visibility", visibility);
          }
          return builder;
        })
        .paginate(paginationOpts);
    }

    // Use compound index - can chain conditions based on provided filters
    // Index order: ["schoolId", "isArchived", "visibility"]
    // Must provide earlier conditions to use later ones in compound index

    if (isArchived !== undefined && visibility !== undefined) {
      // Both filters provided - use full index
      return await ctx.db
        .query("schoolClasses")
        .withIndex("schoolId_isArchived_visibility", (q) =>
          q
            .eq("schoolId", schoolId)
            .eq("isArchived", isArchived)
            .eq("visibility", visibility)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    if (isArchived !== undefined) {
      // Only isArchived filter - use partial index
      return await ctx.db
        .query("schoolClasses")
        .withIndex("schoolId_isArchived_visibility", (q) =>
          q.eq("schoolId", schoolId).eq("isArchived", isArchived)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    // No filters or only visibility filter - get all and filter in code if needed
    // (Can't skip isArchived in compound index to filter by visibility alone)
    const result = await ctx.db
      .query("schoolClasses")
      .withIndex("schoolId_isArchived_visibility", (q) =>
        q.eq("schoolId", schoolId)
      )
      .order("desc")
      .paginate(paginationOpts);

    // If visibility filter is provided but isArchived isn't, filter in code
    if (visibility !== undefined) {
      return {
        ...result,
        page: result.page.filter((c) => c.visibility === visibility),
      };
    }

    return result;
  },
});

/**
 * Get the name of a class.
 * Accessible by anyone.
 */
export const getClassInfo = query({
  args: {
    classId: v.id("schoolClasses"),
  },
  handler: async (ctx, args) => {
    const classData = await ctx.db.get("schoolClasses", args.classId);

    if (!classData) {
      return null;
    }

    return {
      name: classData.name,
      subject: classData.subject,
      year: classData.year,
      image: classData.image,
      visibility: classData.visibility,
    };
  },
});

/**
 * Verify if the current user is allowed to access a class.
 *
 * Access is granted if user is either:
 * 1. A direct class member (teacher/student)
 * 2. A school admin (can access all classes in their school)
 */
export const verifyClassMembership = query({
  args: {
    classId: v.id("schoolClasses"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const classData = await ctx.db.get("schoolClasses", args.classId);
    if (!classData) {
      return { allow: false };
    }

    const { hasAccess, schoolMembership } = await checkClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      user.appUser._id
    );

    return { allow: hasAccess && !!schoolMembership };
  },
});

/**
 * Get a class by its ID with membership information.
 *
 * Returns the class data along with:
 * - classMembership: User's direct membership in this class (null if not a member)
 * - schoolMembership: User's membership in the school (for admin access check)
 *
 * Access is granted if user is either:
 * 1. A direct class member (teacher/student)
 * 2. A school admin (can access all classes in their school)
 */
export const getClass = query({
  args: {
    classId: v.id("schoolClasses"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const { classData, classMembership, schoolMembership } =
      await loadClassWithAccess(ctx, args.classId, user.appUser._id);

    return {
      class: classData,
      classMembership, // null if admin-only access
      schoolMembership, // Always present - frontend can check role
    };
  },
});

/**
 * Get all members of a class with search and pagination.
 * Returns enriched user data (name, email, image) for each member.
 */
export const getPeople = query({
  args: {
    classId: v.id("schoolClasses"),
    q: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { classId, q, paginationOpts } = args;

    const user = await requireAuth(ctx);
    await loadClassWithAccess(ctx, classId, user.appUser._id);

    const membersPage = await ctx.db
      .query("schoolClassMembers")
      .withIndex("classId_userId", (idx) => idx.eq("classId", classId))
      .paginate(paginationOpts);

    const userMap = await getUserMap(
      ctx,
      membersPage.page.map((m) => m.userId)
    );

    const people = membersPage.page.flatMap((member) => {
      const userData = userMap.get(member.userId);
      if (!userData) {
        return [];
      }

      if (q && q.trim().length > 0) {
        const searchLower = q.toLowerCase().trim();
        const matches =
          userData.name.toLowerCase().includes(searchLower) ||
          userData.email.toLowerCase().includes(searchLower);
        if (!matches) {
          return [];
        }
      }

      return [{ ...member, user: userData }];
    });

    // Sort in code: teachers first, then students
    people.sort((a, b) => {
      if (a.role === "teacher" && b.role === "student") {
        return -1;
      }
      if (a.role === "student" && b.role === "teacher") {
        return 1;
      }
      return 0;
    });

    return {
      ...membersPage,
      page: people,
    };
  },
});

/**
 * Get all invite codes for a class.
 * Only accessible by authenticated users who have access to the class.
 */
export const getInviteCodes = query({
  args: {
    classId: v.id("schoolClasses"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await loadClassWithAccess(ctx, args.classId, user.appUser._id);

    // Get all invite codes for the class (using compound index, omitting role)
    return await ctx.db
      .query("schoolClassInviteCodes")
      .withIndex("classId_role", (idx) => idx.eq("classId", args.classId))
      .collect();
  },
});

/**
 * Get all forums for a class with optional search and pagination.
 * Supports full-text search by title.
 * Returns enriched data with user info, reactions, and unread status.
 */
export const getForums = query({
  args: {
    classId: v.id("schoolClasses"),
    q: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { classId, q: searchQuery, paginationOpts } = args;

    const user = await requireAuth(ctx);
    await loadClassWithAccess(ctx, classId, user.appUser._id);

    // If search query is provided, use full-text search
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

    // Fetch all enrichment data in parallel (single batch per type)
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

/**
 * Get a forum by its ID with read state.
 * Only accessible by authenticated users who have access to the class.
 * Includes lastReadAt for unread indicator (combined to avoid multiple queries).
 */
export const getForum = query({
  args: {
    forumId: v.id("schoolClassForums"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const currentUserId = user.appUser._id;

    // Load forum first (needed for schoolId/classId)
    const forum = await loadForum(ctx, args.forumId);

    // Parallelize: access check + reactions + read state
    const [, reactions, lastReadAt] = await Promise.all([
      requireClassAccess(ctx, forum.classId, forum.schoolId, currentUserId),
      ctx.db
        .query("schoolClassForumReactions")
        .withIndex("forumId_userId_emoji", (q) => q.eq("forumId", forum._id))
        .collect(),
      getForumLastReadAt(ctx, forum._id, currentUserId),
    ]);

    // Batch fetch all user data (author + reactors)
    const reactorUserIds = reactions.map((r) => r.userId);
    const userMap = await getUserMap(ctx, [forum.createdBy, ...reactorUserIds]);

    // Get current user's reactions
    const myReactions = reactions
      .filter((r) => r.userId === currentUserId)
      .map((r) => r.emoji);

    // Build reactor names by emoji
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

/**
 * Get forum posts with pagination.
 * Returns enriched posts with user data and reactions.
 */
export const getForumPosts = query({
  args: {
    forumId: v.id("schoolClassForums"),
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

/**
 * Get forum posts around a specific post (for "jump to message").
 * Returns posts before and after the target post.
 */
export const getForumPostsAround = query({
  args: {
    forumId: v.id("schoolClassForums"),
    targetPostId: v.id("schoolClassForumPosts"),
    limit: v.optional(v.number()), // Posts to fetch before/after (default 15)
  },
  handler: async (ctx, args) => {
    const { forumId, targetPostId, limit = 15 } = args;

    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, forumId, user.appUser._id);

    // Get the target post to find its creation time
    const targetPost = await ctx.db.get("schoolClassForumPosts", targetPostId);
    if (!targetPost || targetPost.forumId !== forumId) {
      throw new ConvexError({
        code: "POST_NOT_FOUND",
        message: `Post not found for postId: ${targetPostId}`,
      });
    }

    const targetTime = targetPost._creationTime;

    // Fetch posts before and after in parallel for better performance
    const [postsBefore, postsAfter] = await Promise.all([
      // Posts before target (older) - order desc to get closest first
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("forumId", (q) =>
          q.eq("forumId", forumId).lt("_creationTime", targetTime)
        )
        .order("desc")
        .take(limit),
      // Posts after target (newer) - order asc to get closest first
      ctx.db
        .query("schoolClassForumPosts")
        .withIndex("forumId", (q) =>
          q.eq("forumId", forumId).gt("_creationTime", targetTime)
        )
        .order("asc")
        .take(limit),
    ]);

    // Combine: before (reversed to asc) + target + after
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

/**
 * Get older forum posts (before a given timestamp).
 * Used for bidirectional pagination when viewing old messages.
 */
export const getForumPostsOlder = query({
  args: {
    forumId: v.id("schoolClassForums"),
    beforeTime: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { forumId, beforeTime, limit = 15 } = args;

    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, forumId, user.appUser._id);

    // Use index condition instead of .filter() for better performance
    // Index "forumId" implicitly includes _creationTime at the end
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

/**
 * Get newer forum posts (after a given timestamp).
 * Used for bidirectional pagination when viewing old messages.
 */
export const getForumPostsNewer = query({
  args: {
    forumId: v.id("schoolClassForums"),
    afterTime: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { forumId, afterTime, limit = 15 } = args;

    const user = await requireAuth(ctx);
    await loadForumWithAccess(ctx, forumId, user.appUser._id);

    // Use index condition instead of .filter() for better performance
    // Index "forumId" implicitly includes _creationTime at the end
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
