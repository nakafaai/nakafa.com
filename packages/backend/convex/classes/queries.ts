import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";

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
export const getClassName = query({
  args: {
    classId: v.id("schoolClasses"),
  },
  handler: async (ctx, args) => {
    const classData = await ctx.db.get(args.classId);
    return classData?.name;
  },
});
