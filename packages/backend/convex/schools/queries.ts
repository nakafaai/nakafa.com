import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { safeGetAppUser } from "../auth";

/**
 * Get a school by its ID. Requires authentication.
 */
export const getSchool = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    // Authentication check - must be logged in
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to view this school.",
      });
    }

    const school = await ctx.db.get(args.schoolId);
    if (!school) {
      throw new ConvexError({
        code: "SCHOOL_NOT_FOUND",
        message: `School not found for schoolId: ${args.schoolId}`,
      });
    }

    return school;
  },
});

export const getSchoolBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to view this school.",
      });
    }

    const school = await ctx.db
      .query("schools")
      .withIndex("slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!school) {
      throw new ConvexError({
        code: "SCHOOL_NOT_FOUND",
        message: `School not found for slug: ${args.slug}`,
      });
    }

    return school;
  },
});

/**
 * Get all school memberships for the current user.
 */
export const getSchoolMemberships = query({
  args: {},
  handler: async (ctx) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to view your school memberships.",
      });
    }

    const memberships = await ctx.db
      .query("schoolMembers")
      .withIndex("userId", (q) => q.eq("userId", user.appUser._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return memberships;
  },
});
