import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { safeGetAppUser } from "../auth";

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

    // Get user's school membership (needed for admin check)
    const schoolMembership = await ctx.db
      .query("schoolMembers")
      .withIndex("schoolId_userId_status", (q) =>
        q
          .eq("schoolId", classData.schoolId)
          .eq("userId", user.appUser._id)
          .eq("status", "active")
      )
      .unique();

    if (!schoolMembership) {
      return { allow: false };
    }

    // Get user's class membership (may be null for admins)
    const classMembership = await ctx.db
      .query("schoolClassMembers")
      .withIndex("classId_userId", (q) =>
        q.eq("classId", args.classId).eq("userId", user.appUser._id)
      )
      .unique();

    // Check access: either class member OR school admin
    const allow = classMembership !== null || schoolMembership.role === "admin";

    return { allow };
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
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to view this class.",
      });
    }

    // Get the class
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: `Class not found for classId: ${args.classId}`,
      });
    }

    // Get user's school membership (needed for admin check)
    const schoolMembership = await ctx.db
      .query("schoolMembers")
      .withIndex("schoolId_userId_status", (q) =>
        q
          .eq("schoolId", classData.schoolId)
          .eq("userId", user.appUser._id)
          .eq("status", "active")
      )
      .unique();

    // User must be a school member to access any class
    if (!schoolMembership) {
      throw new ConvexError({
        code: "ACCESS_DENIED",
        message: "You must be a member of this school to access this class.",
      });
    }

    // Get user's class membership (may be null for admins)
    const classMembership = await ctx.db
      .query("schoolClassMembers")
      .withIndex("classId_userId", (q) =>
        q.eq("classId", args.classId).eq("userId", user.appUser._id)
      )
      .unique();

    // Check access: either class member OR school admin
    const hasAccess =
      classMembership !== null || schoolMembership.role === "admin";

    if (!hasAccess) {
      throw new ConvexError({
        code: "ACCESS_DENIED",
        message: "You do not have access to this class.",
      });
    }

    return {
      class: classData,
      classMembership, // null if admin-only access
      schoolMembership, // Always present - frontend can check role
    };
  },
});
