import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  validateInviteCodeState,
  validateNotExistingMembership,
} from "@repo/backend/convex/lib/helpers/invite";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { generateUniqueSlug } from "@repo/backend/convex/schools/utils";
import { generateNanoId } from "@repo/backend/convex/utils/id";
import { slugify } from "@repo/backend/convex/utils/text";
import { ConvexError, v } from "convex/values";
import { schoolTypeValidator } from "./schema";

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
    type: schoolTypeValidator,
  },
  returns: v.object({
    schoolId: vv.id("schools"),
    slug: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check if school with same email already exists
    const existingSchoolByEmail = await ctx.db
      .query("schools")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

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
  returns: v.object({
    schoolId: vv.id("schools"),
    slug: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Find invite code
    const inviteCode = await ctx.db
      .query("schoolInviteCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!inviteCode) {
      throw new ConvexError({
        code: "INVALID_CODE",
        message: "Invalid invite code.",
      });
    }

    validateInviteCodeState(inviteCode);

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
      .withIndex("by_schoolId_and_userId_and_status", (q) =>
        q.eq("schoolId", school._id).eq("userId", userId).eq("status", "active")
      )
      .unique();

    validateNotExistingMembership(existingMember, "school");

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
