import {
  schoolClassImages,
  schoolClassVisibility,
} from "@repo/backend/convex/classes/schema";
import { loadActiveClass } from "@repo/backend/convex/classes/utils";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/authHelpers";
import {
  getRandomClassImage,
  isValidClassImage,
} from "@repo/backend/convex/lib/images";
import {
  PERMISSIONS,
  requirePermission,
} from "@repo/backend/convex/lib/permissions";
import { generateNanoId } from "@repo/backend/convex/utils/helper";
import { ConvexError, v } from "convex/values";

export const createClass = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    subject: v.string(),
    year: v.string(),
    visibility: schoolClassVisibility,
  },
  returns: v.id("schoolClasses"),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;

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
      image: getRandomClassImage(now.toString()),
      isArchived: false,
      visibility: args.visibility,
      studentCount: 0,
      teacherCount: 0,
      createdBy: userId,
      updatedBy: userId,
      updatedAt: now,
    });

    await ctx.db.insert("schoolClassMembers", {
      classId,
      userId,
      schoolId: args.schoolId,
      role: "teacher",
      teacherRole: "primary",
      updatedAt: now,
      addedBy: userId,
    });

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

export const joinClass = mutation({
  args: {
    code: v.string(),
  },
  returns: v.object({ classId: v.id("schoolClasses") }),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;

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

    if (!inviteCode.enabled) {
      throw new ConvexError({
        code: "CODE_DISABLED",
        message: "This invite code has been disabled.",
      });
    }

    if (inviteCode.expiresAt && inviteCode.expiresAt < Date.now()) {
      throw new ConvexError({
        code: "CODE_EXPIRED",
        message: "This invite code has expired.",
      });
    }

    if (inviteCode.maxUsage && inviteCode.currentUsage >= inviteCode.maxUsage) {
      throw new ConvexError({
        code: "CODE_LIMIT_REACHED",
        message: "This invite code has reached its usage limit.",
      });
    }

    const classData = await loadActiveClass(ctx, inviteCode.classId);

    const now = Date.now();

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

    if (inviteCode.role === "teacher") {
      await ctx.db.insert("schoolClassMembers", {
        classId: classData._id,
        userId,
        schoolId: classData.schoolId,
        role: "teacher",
        teacherRole: "co-teacher",
        inviteCodeId: inviteCode._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("schoolClassMembers", {
        classId: classData._id,
        userId,
        schoolId: classData.schoolId,
        role: "student",
        enrollMethod: "code",
        inviteCodeId: inviteCode._id,
        updatedAt: now,
      });
    }

    return { classId: classData._id };
  },
});

export const updateClassVisibility = mutation({
  args: {
    classId: v.id("schoolClasses"),
    visibility: schoolClassVisibility,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;

    const classData = await loadActiveClass(ctx, args.classId);

    await requirePermission(ctx, PERMISSIONS.CLASS_WRITE, {
      userId,
      classId: args.classId,
      schoolId: classData.schoolId,
    });

    await ctx.db.patch("schoolClasses", args.classId, {
      visibility: args.visibility,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const joinPublicClass = mutation({
  args: {
    classId: v.id("schoolClasses"),
  },
  returns: v.object({ classId: v.id("schoolClasses") }),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;

    const classData = await loadActiveClass(ctx, args.classId);

    if (classData.visibility !== "public") {
      throw new ConvexError({
        code: "CLASS_NOT_PUBLIC",
        message: "This class is not public. Please use an invite code to join.",
      });
    }

    const now = Date.now();

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

    await ctx.db.insert("schoolClassMembers", {
      classId: classData._id,
      userId,
      schoolId: classData.schoolId,
      role: "student",
      enrollMethod: "public",
      updatedAt: now,
    });

    return { classId: classData._id };
  },
});

export const updateClassImage = mutation({
  args: {
    classId: v.id("schoolClasses"),
    image: schoolClassImages,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;

    const classData = await loadActiveClass(ctx, args.classId);

    await requirePermission(ctx, PERMISSIONS.CLASS_WRITE, {
      userId,
      classId: args.classId,
      schoolId: classData.schoolId,
    });

    if (!isValidClassImage(args.image)) {
      throw new ConvexError({
        code: "INVALID_IMAGE",
        message: "Invalid class image. Please select a valid image.",
      });
    }

    await ctx.db.patch("schoolClasses", args.classId, {
      image: args.image,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    return null;
  },
});
