import { ConvexError, v } from "convex/values";
import { safeGetAppUser } from "../auth";
import { mutation } from "../functions";
import { generateNanoId } from "../utils/helper";
import { getRandomClassImage, PERMISSION_SETS } from "./constants";

/**
 * Create a new class in a school and automatically add the creator as a primary teacher.
 */
export const createClass = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    subject: v.string(),
    year: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to create a class.",
      });
    }

    const userId = user.appUser._id;

    // Verify school membership and permissions
    const schoolMember = await ctx.db
      .query("schoolMembers")
      .withIndex("schoolId_userId_status", (q) =>
        q
          .eq("schoolId", args.schoolId)
          .eq("userId", userId)
          .eq("status", "active")
      )
      .first();

    if (
      !schoolMember ||
      (schoolMember.role !== "admin" && schoolMember.role !== "teacher")
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to create classes in this school.",
      });
    }

    const now = Date.now();

    const classId = await ctx.db.insert("schoolClasses", {
      schoolId: args.schoolId,
      name: args.name,
      subject: args.subject,
      year: args.year,
      image: getRandomClassImage(now.toString()), // Use class name as seed for consistent image
      isArchived: false,
      studentCount: 0,
      teacherCount: 0,
      createdBy: userId,
      updatedBy: userId,
      updatedAt: now,
    });

    // Automatically add creator as primary teacher
    await ctx.db.insert("schoolClassMembers", {
      classId,
      userId,
      schoolId: args.schoolId,
      role: "teacher",
      teacherRole: "primary",
      teacherPermissions: PERMISSION_SETS.PRIMARY,
      updatedAt: now,
      addedBy: userId,
    });

    // Generate invite codes for teacher and student roles
    const roles = ["teacher", "student"] as const;
    for (const role of roles) {
      await ctx.db.insert("schoolClassInviteCodes", {
        classId,
        schoolId: args.schoolId,
        role,
        code: generateNanoId(),
        enabled: true,
        currentUsage: 0,
        createdBy: userId,
        updatedBy: userId,
        updatedAt: now,
      });
    }

    return classId;
  },
});

/**
 * Join a class using an invite code.
 */
export const joinClass = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to join a class.",
      });
    }

    // Find invite code
    const inviteCode = await ctx.db
      .query("schoolClassInviteCodes")
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

    // Get class
    const classData = await ctx.db.get(inviteCode.classId);
    if (!classData) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: "Class not found.",
      });
    }

    // Check if class is archived
    if (classData.isArchived) {
      throw new ConvexError({
        code: "CLASS_ARCHIVED",
        message: "Cannot join an archived class.",
      });
    }

    const now = Date.now();
    const userId = user.appUser._id;

    // Check if user is already a member
    const existingMember = await ctx.db
      .query("schoolClassMembers")
      .withIndex("classId_userId", (q) =>
        q.eq("classId", classData._id).eq("userId", userId)
      )
      .first();

    if (existingMember) {
      throw new ConvexError({
        code: "ALREADY_MEMBER",
        message: "You are already a member of this class.",
      });
    }

    // Check if user is a member of the school
    const schoolMember = await ctx.db
      .query("schoolMembers")
      .withIndex("schoolId_userId_status", (q) =>
        q
          .eq("schoolId", classData.schoolId)
          .eq("userId", userId)
          .eq("status", "active")
      )
      .first();

    if (!schoolMember) {
      throw new ConvexError({
        code: "NOT_SCHOOL_MEMBER",
        message: "You must be a member of the school to join this class.",
      });
    }

    // Add user as class member with role from invite code
    if (inviteCode.role === "teacher") {
      await ctx.db.insert("schoolClassMembers", {
        classId: classData._id,
        userId,
        schoolId: classData.schoolId,
        role: "teacher",
        teacherRole: "co-teacher",
        teacherPermissions: PERMISSION_SETS.CO_TEACHER,
        inviteCodeId: inviteCode._id, // Track which code was used (trigger will update usage count)
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("schoolClassMembers", {
        classId: classData._id,
        userId,
        schoolId: classData.schoolId,
        role: "student",
        enrollMethod: "code",
        inviteCodeId: inviteCode._id, // Track which code was used (trigger will update usage count)
        updatedAt: now,
      });
    }

    return { classId: classData._id };
  },
});
