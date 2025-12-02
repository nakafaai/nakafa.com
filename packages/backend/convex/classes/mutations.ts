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
    const code = generateNanoId();

    const classId = await ctx.db.insert("schoolClasses", {
      schoolId: args.schoolId,
      name: args.name,
      subject: args.subject,
      year: args.year,
      image: getRandomClassImage(code),
      code,
      codeEnabled: true,
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

    return classId;
  },
});
