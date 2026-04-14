import { SCHOOL_CLASS_INVITE_CODE_ROLES } from "@repo/backend/convex/classes/constants";
import {
  schoolClassImageValidator,
  schoolClassVisibilityValidator,
} from "@repo/backend/convex/classes/schema";
import { loadActiveClass } from "@repo/backend/convex/classes/utils";
import { classJoinMutationResultValidator } from "@repo/backend/convex/classes/validators";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  validateInviteCodeState,
  validateNotExistingMembership,
} from "@repo/backend/convex/lib/helpers/invite";
import {
  PERMISSIONS,
  requirePermission,
} from "@repo/backend/convex/lib/helpers/permissions";
import { getSchoolMembership } from "@repo/backend/convex/lib/helpers/school";
import {
  getRandomClassImage,
  isValidClassImage,
} from "@repo/backend/convex/lib/images";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { generateNanoId } from "@repo/backend/convex/utils/id";
import { ConvexError, v } from "convex/values";

/** Create one class and its default teacher/student invite codes. */
export const createClass = mutation({
  args: {
    schoolId: vv.id("schools"),
    name: v.string(),
    subject: v.string(),
    year: v.string(),
    visibility: schoolClassVisibilityValidator,
  },
  returns: vv.id("schoolClasses"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    await requirePermission(ctx, PERMISSIONS.CLASS_CREATE, {
      schoolId: args.schoolId,
      userId,
    });

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

    for (const role of SCHOOL_CLASS_INVITE_CODE_ROLES) {
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
  returns: classJoinMutationResultValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;

    const inviteCode = await ctx.db
      .query("schoolClassInviteCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!inviteCode) {
      throw new ConvexError({
        code: "INVALID_CODE",
        message: "Invalid invite code.",
      });
    }

    validateInviteCodeState(inviteCode);

    const classData = await loadActiveClass(ctx, inviteCode.classId);

    const now = Date.now();

    const existingMember = await ctx.db
      .query("schoolClassMembers")
      .withIndex("by_classId_and_userId", (q) =>
        q.eq("classId", classData._id).eq("userId", userId)
      )
      .unique();

    validateNotExistingMembership(existingMember, "class");

    const schoolMember = await getSchoolMembership(
      ctx,
      classData.schoolId,
      userId
    );

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
        enrollMethod: "by_code",
        inviteCodeId: inviteCode._id,
        updatedAt: now,
      });
    }

    return { classId: classData._id };
  },
});

export const updateClassVisibility = mutation({
  args: {
    classId: vv.id("schoolClasses"),
    visibility: schoolClassVisibilityValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
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
    classId: vv.id("schoolClasses"),
  },
  returns: classJoinMutationResultValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
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
      .withIndex("by_classId_and_userId", (q) =>
        q.eq("classId", classData._id).eq("userId", userId)
      )
      .unique();

    validateNotExistingMembership(existingMember, "class");

    const schoolMember = await getSchoolMembership(
      ctx,
      classData.schoolId,
      userId
    );

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
    classId: vv.id("schoolClasses"),
    image: schoolClassImageValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
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
