import { ConvexError, v } from "convex/values";
import { safeGetAppUser } from "../auth";
import { mutation } from "../functions";
import { slugify } from "../utils/helper";
import { generateUniqueSlug } from "./utils";

/**
 * Create a new school and automatically add the creator as an admin member.
 * The creator becomes the admin of the school automatically.
 */
export const createSchool = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    address: v.string(),
    city: v.string(),
    province: v.string(),
    type: v.union(
      v.literal("elementary-school"),
      v.literal("middle-school"),
      v.literal("high-school"),
      v.literal("vocational-school"),
      v.literal("university"),
      v.literal("other")
    ),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to create a school.",
      });
    }

    // Check if school with same email already exists
    const existingSchoolByEmail = await ctx.db
      .query("schools")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existingSchoolByEmail) {
      throw new ConvexError({
        code: "SCHOOL_ALREADY_EXISTS",
        message: "A school with this email already exists.",
      });
    }

    // Generate unique slug
    const baseSlug = slugify(args.name);
    const uniqueSlug = await generateUniqueSlug(ctx, baseSlug);

    const now = Date.now();
    const userId = user.appUser._id;

    // Create school
    const schoolId = await ctx.db.insert("schools", {
      name: args.name,
      slug: uniqueSlug,
      email: args.email,
      phone: args.phone,
      address: args.address,
      city: args.city,
      province: args.province,
      type: args.type,
      createdBy: userId,
      updatedBy: userId,
      updatedAt: now,
      currentStudents: 0,
      currentTeachers: 0,
    });

    // Create school member record - creator becomes admin automatically
    await ctx.db.insert("schoolMembers", {
      schoolId,
      userId,
      role: "admin",
      status: "active",
      joinedAt: now,
      updatedAt: now,
    });

    return { schoolId, slug: uniqueSlug };
  },
});
