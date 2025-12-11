import { ConvexError, v } from "convex/values";
import { safeGetAppUser } from "../auth";
import { mutation } from "../functions";
import { generateNanoId, slugify } from "../utils/helper";
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

    // Generate invite codes for each role
    const roles = ["teacher", "student", "parent", "demo"] as const;
    for (const role of roles) {
      await ctx.db.insert("schoolInviteCodes", {
        schoolId,
        role,
        code: generateNanoId(),
        enabled: true,
        currentUsage: 0,
        createdBy: userId,
        updatedBy: userId,
        updatedAt: now,
      });
    }

    return { schoolId, slug: uniqueSlug };
  },
});

export const joinSchool = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to join a school.",
      });
    }

    // Find invite code
    const inviteCode = await ctx.db
      .query("schoolInviteCodes")
      .withIndex("code", (q) => q.eq("code", args.code))
      .first();

    if (!inviteCode) {
      throw new ConvexError({
        code: "INVALID_CODE",
        message: "Invalid invite code.",
      });
    }

    // Check if code is enabled
    if (!inviteCode.enabled) {
      throw new ConvexError({
        code: "CODE_DISABLED",
        message: "This invite code has been disabled.",
      });
    }

    // Check expiry
    if (inviteCode.expiresAt && inviteCode.expiresAt < Date.now()) {
      throw new ConvexError({
        code: "CODE_EXPIRED",
        message: "This invite code has expired.",
      });
    }

    // Check usage limit
    if (inviteCode.maxUsage && inviteCode.currentUsage >= inviteCode.maxUsage) {
      throw new ConvexError({
        code: "CODE_LIMIT_REACHED",
        message: "This invite code has reached its usage limit.",
      });
    }

    // Get school
    const school = await ctx.db.get("schools", inviteCode.schoolId);
    if (!school) {
      throw new ConvexError({
        code: "SCHOOL_NOT_FOUND",
        message: "School not found.",
      });
    }

    const now = Date.now();
    const userId = user.appUser._id;

    // Check if user is already a member
    const existingMember = await ctx.db
      .query("schoolMembers")
      .withIndex("schoolId_userId", (q) =>
        q.eq("schoolId", school._id).eq("userId", userId)
      )
      .first();

    if (existingMember) {
      throw new ConvexError({
        code: "ALREADY_MEMBER",
        message: "You are already a member of this school.",
      });
    }

    // Add user as member with role from invite code
    await ctx.db.insert("schoolMembers", {
      schoolId: school._id,
      userId,
      role: inviteCode.role,
      status: "active",
      inviteCodeId: inviteCode._id, // Track which code was used (trigger will update usage count)
      joinedAt: now,
      updatedAt: now,
    });

    return { schoolId: school._id, slug: school.slug };
  },
});
