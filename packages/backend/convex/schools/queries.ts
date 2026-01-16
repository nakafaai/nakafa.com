import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/authHelpers";
import { getAll } from "@repo/backend/convex/lib/relationships";
import { ConvexError, v } from "convex/values";

/**
 * Get a school by its ID. Requires authentication.
 */
export const getSchool = query({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const school = await ctx.db.get("schools", args.schoolId);
    if (!school) {
      throw new ConvexError({
        code: "SCHOOL_NOT_FOUND",
        message: `School not found for schoolId: ${args.schoolId}`,
      });
    }

    return school;
  },
});

export const getSchoolInfoBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
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

    return {
      name: school.name,
    };
  },
});

export const getSchoolBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

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

    const membership = await ctx.db
      .query("schoolMembers")
      .withIndex("schoolId_userId_status", (q) =>
        q
          .eq("schoolId", school._id)
          .eq("userId", user.appUser._id)
          .eq("status", "active")
      )
      .unique();

    if (!membership) {
      throw new ConvexError({
        code: "MEMBERSHIP_NOT_FOUND",
        message: `Membership not found for schoolId: ${school._id} and userId: ${user.appUser._id}`,
      });
    }

    return { school, membership };
  },
});

/**
 * Get all school memberships for the current user.
 * Uses userId_status index for better query performance.
 */
export const getSchoolMemberships = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Use the new userId_status index instead of filter
    const memberships = await ctx.db
      .query("schoolMembers")
      .withIndex("userId_status", (q) =>
        q.eq("userId", user.appUser._id).eq("status", "active")
      )
      .collect();

    return memberships;
  },
});

export const getMySchools = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all active memberships using userId_status index
    const memberships = await ctx.db
      .query("schoolMembers")
      .withIndex("userId_status", (q) =>
        q.eq("userId", user.appUser._id).eq("status", "active")
      )
      .collect();

    // Batch fetch all schools at once using getAll
    const schoolIds = memberships.map((m) => m.schoolId);
    const schools = await getAll(ctx.db, schoolIds);

    // Filter out null values (in case a school was deleted)
    return schools.filter((school) => school !== null);
  },
});
