import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { getAnyAppUserById, safeGetAppUser } from "../auth";
import {
  checkClassAccess,
  requireAuth,
  requireClassAccess,
} from "../lib/authHelpers";
import { asyncMap } from "../lib/relationships";

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

    // Use the most specific index available based on filters
    if (isArchived !== undefined) {
      // Use compound index for schoolId and isArchived
      return await ctx.db
        .query("schoolClasses")
        .withIndex("schoolId_isArchived", (q) =>
          q.eq("schoolId", schoolId).eq("isArchived", isArchived)
        )
        .order("desc")
        .paginate(paginationOpts);
    }

    // No filters, return all school's classes
    return await ctx.db
      .query("schoolClasses")
      .withIndex("schoolId", (q) => q.eq("schoolId", schoolId))
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

    // Paginate class members
    const membersPage = await ctx.db
      .query("schoolClassMembers")
      .withIndex("classId", (idx) => idx.eq("classId", classId))
      .paginate(paginationOpts);

    // Enrich with user data
    const enrichedPeople = await asyncMap(membersPage.page, async (member) => {
      const userData = await getAnyAppUserById(ctx, member.userId);
      if (!userData) {
        return null;
      }

      return {
        ...member,
        user: {
          _id: userData.appUser._id,
          name: userData.authUser.name,
          email: userData.authUser.email,
          image: userData.authUser.image,
        },
      };
    });

    // Filter nulls and apply search if provided
    let people = enrichedPeople.filter((p) => p !== null);

    if (q && q.trim().length > 0) {
      const searchLower = q.toLowerCase().trim();
      people = people.filter(
        (p) =>
          p.user.name.toLowerCase().includes(searchLower) ||
          p.user.email.toLowerCase().includes(searchLower)
      );
    }

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

    // Get all invite codes for the class
    return await ctx.db
      .query("schoolClassInviteCodes")
      .withIndex("classId", (idx) => idx.eq("classId", args.classId))
      .collect();
  },
});
