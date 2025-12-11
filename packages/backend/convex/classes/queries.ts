import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { safeGetAppUser } from "../auth";
import {
  checkClassAccess,
  requireAuth,
  requireClassAccess,
} from "../lib/authHelpers";
import { asyncMap } from "../lib/relationships";
import { getUserMap } from "../lib/userHelpers";
import { attachForumUsers } from "./utils";

/**
 * Get all classes for a school with optional search and filtering.
 * Supports full-text search by name and filtering by archived status.
 */
export const getClasses = query({
  args: {
    schoolId: v.id("schools"),
    q: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { schoolId, q: searchQuery, isArchived, paginationOpts } = args;

    // If search query is provided and not empty, use full-text search
    if (searchQuery && searchQuery.trim().length > 0) {
      return await ctx.db
        .query("schoolClasses")
        .withSearchIndex("search_name", (q) => {
          let builder = q.search("name", searchQuery).eq("schoolId", schoolId);
          if (isArchived !== undefined) {
            builder = builder.eq("isArchived", isArchived);
          }
          return builder;
        })
        .paginate(paginationOpts);
    }

    // Use compound index - can omit isArchived condition when not filtering
    if (isArchived !== undefined) {
      return await ctx.db
        .query("schoolClasses")
        .withIndex("schoolId_isArchived", (q) =>
          q.eq("schoolId", schoolId).eq("isArchived", isArchived)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    // No filters - use same index, just omit isArchived condition
    return await ctx.db
      .query("schoolClasses")
      .withIndex("schoolId_isArchived", (q) => q.eq("schoolId", schoolId))
      .order("desc")
      .paginate(paginationOpts);
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
    const classData = await ctx.db.get(args.classId);

    if (!classData) {
      return null;
    }

    return {
      name: classData.name,
      subject: classData.subject,
      year: classData.year,
      image: classData.image,
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
    const user = await safeGetAppUser(ctx);
    if (!user) {
      return { allow: false };
    }

    // Get the class to verify it exists
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      return { allow: false };
    }

    // Use centralized access check
    const { hasAccess, schoolMembership } = await checkClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      user.appUser._id
    );

    if (!schoolMembership) {
      return { allow: false };
    }

    return { allow: hasAccess };
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

    // Get the class
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: `Class not found for classId: ${args.classId}`,
      });
    }

    // Use centralized access check (throws on access denied)
    const { classMembership, schoolMembership } = await requireClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      user.appUser._id
    );

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

    // Require authentication
    const user = await requireAuth(ctx);

    // Get the class to verify it exists
    const classData = await ctx.db.get(classId);
    if (!classData) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: `Class not found for classId: ${classId}`,
      });
    }

    // Verify user has access to this class
    await requireClassAccess(
      ctx,
      classId,
      classData.schoolId,
      user.appUser._id
    );

    // Use compound index, omit userId condition to get all members
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
    // Require authentication
    const user = await requireAuth(ctx);

    // Get the class to verify it exists
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: `Class not found for classId: ${args.classId}`,
      });
    }

    // Verify user has access to this class
    await requireClassAccess(
      ctx,
      args.classId,
      classData.schoolId,
      user.appUser._id
    );

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
 * Returns enriched data with user info for createdBy.
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

    // Get the class to verify it exists
    const classData = await ctx.db.get(classId);
    if (!classData) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: `Class not found for classId: ${classId}`,
      });
    }

    // Verify user has access to this class
    await requireClassAccess(
      ctx,
      classId,
      classData.schoolId,
      user.appUser._id
    );

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

    // Attach user data
    const userMap = await attachForumUsers(ctx, forumsPage.page);

    return {
      ...forumsPage,
      page: forumsPage.page.map((forum) => ({
        ...forum,
        user: userMap.get(forum.createdBy) ?? null,
      })),
    };
  },
});

/**
 * Get a forum by its ID.
 * Only accessible by authenticated users who have access to the class.
 */
export const getForum = query({
  args: {
    forumId: v.id("schoolClassForums"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const currentUserId = user.appUser._id;

    const forum = await ctx.db.get(args.forumId);
    if (!forum) {
      throw new ConvexError({
        code: "FORUM_NOT_FOUND",
        message: `Forum not found for forumId: ${args.forumId}`,
      });
    }

    await requireClassAccess(ctx, forum.classId, forum.schoolId, currentUserId);

    // Fetch all reactions for this forum
    const reactions = await ctx.db
      .query("schoolClassForumReactions")
      .withIndex("forumId_userId_emoji", (idx) => idx.eq("forumId", forum._id))
      .collect();

    // Collect all user IDs (author + reactors)
    const reactorUserIds = reactions.map((r) => r.userId);
    const allUserIds = [forum.createdBy, ...reactorUserIds];
    const userMap = await getUserMap(ctx, allUserIds);

    // Get current user's reactions
    const myReactions = reactions
      .filter((r) => r.userId === currentUserId)
      .map((r) => r.emoji);

    // Group reactions by emoji with reactor names (limit to 10 per emoji)
    const reactorsByEmoji = new Map<string, string[]>();
    for (const reaction of reactions) {
      const userName = userMap.get(reaction.userId)?.name ?? "Unknown";
      const existing = reactorsByEmoji.get(reaction.emoji) ?? [];
      if (existing.length < 10) {
        existing.push(userName);
      }
      reactorsByEmoji.set(reaction.emoji, existing);
    }

    return {
      ...forum,
      user: userMap.get(forum.createdBy) ?? null,
      myReactions,
      reactionUsers: forum.reactionCounts.map(({ emoji, count }) => ({
        emoji,
        count,
        reactors: reactorsByEmoji.get(emoji) ?? [],
      })),
    };
  },
});

export const getForumPosts = query({
  args: {
    forumId: v.id("schoolClassForums"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { forumId, paginationOpts } = args;

    const user = await requireAuth(ctx);

    const forum = await ctx.db.get(forumId);
    if (!forum) {
      throw new ConvexError({
        code: "FORUM_NOT_FOUND",
        message: `Forum not found for forumId: ${forumId}`,
      });
    }

    await requireClassAccess(
      ctx,
      forum.classId,
      forum.schoolId,
      user.appUser._id
    );

    const postsPage = await ctx.db
      .query("schoolClassForumPosts")
      .withIndex("forumId", (idx) => idx.eq("forumId", forumId))
      .order("asc")
      .paginate(paginationOpts);

    const postIds = postsPage.page.map((p) => p._id);

    // Fetch all reactions for all posts (for showing who reacted)
    const allReactions = await asyncMap(postIds, (postId) =>
      ctx.db
        .query("schoolClassForumPostReactions")
        .withIndex("postId_userId_emoji", (idx) => idx.eq("postId", postId))
        .collect()
    );

    // Collect all user IDs (authors + replyToUsers + reactors) for batch fetching
    const reactorUserIds = allReactions.flat().map((r) => r.userId);
    const allUserIds = [
      ...postsPage.page.flatMap((p) =>
        p.replyToUserId ? [p.createdBy, p.replyToUserId] : [p.createdBy]
      ),
      ...reactorUserIds,
    ];
    const userMap = await getUserMap(ctx, allUserIds);

    // Build maps for each post
    const currentUserId = user.appUser._id;
    const reactionDataMap = new Map(
      postIds.map((postId, i) => {
        const reactions = allReactions[i];
        const myReactions = reactions
          .filter((r) => r.userId === currentUserId)
          .map((r) => r.emoji);

        // Group reactions by emoji with reactor names (limit to 10 per emoji)
        const reactorsByEmoji = new Map<string, string[]>();
        for (const reaction of reactions) {
          const userName = userMap.get(reaction.userId)?.name ?? "Unknown";
          const existing = reactorsByEmoji.get(reaction.emoji) ?? [];
          if (existing.length < 10) {
            existing.push(userName);
          }
          reactorsByEmoji.set(reaction.emoji, existing);
        }

        return [postId, { myReactions, reactorsByEmoji }] as const;
      })
    );

    return {
      ...postsPage,
      page: postsPage.page.map((post) => {
        const reactionData = reactionDataMap.get(post._id);
        return {
          ...post,
          user: userMap.get(post.createdBy) ?? null,
          replyToUser: post.replyToUserId
            ? (userMap.get(post.replyToUserId) ?? null)
            : null,
          myReactions: reactionData?.myReactions ?? [],
          // Convert Map to array of { emoji, reactors } for serialization
          reactionUsers: post.reactionCounts.map(({ emoji, count }) => ({
            emoji,
            count,
            reactors: reactionData?.reactorsByEmoji.get(emoji) ?? [],
          })),
        };
      }),
    };
  },
});
