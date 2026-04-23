import { query } from "@repo/backend/convex/_generated/server";
import { paginatedSchoolAssessmentsValidator } from "@repo/backend/convex/assessments/validators";
import { loadClass } from "@repo/backend/convex/classes/utils";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requireClassAccess } from "@repo/backend/convex/lib/helpers/class";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { isAdmin } from "@repo/backend/convex/lib/helpers/school";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

/** List class assessments with teacher/student visibility aligned to materials. */
export const listAssessments = query({
  args: {
    schoolId: v.id("schools"),
    classId: v.optional(v.id("schoolClasses")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedSchoolAssessmentsValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const classData = args.classId ? await loadClass(ctx, args.classId) : null;

    if (classData && classData.schoolId !== args.schoolId) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: "Class not found in this school.",
      });
    }

    if (classData) {
      const { classMembership, schoolMembership } = await requireClassAccess(
        ctx,
        classData._id,
        classData.schoolId,
        user.appUser._id
      );
      const canSeeAllStatuses =
        classMembership?.role === "teacher" || isAdmin(schoolMembership);

      if (canSeeAllStatuses) {
        return ctx.db
          .query("schoolAssessments")
          .withIndex("by_schoolId_and_classId_and_order", (q) =>
            q.eq("schoolId", args.schoolId).eq("classId", classData._id)
          )
          .paginate(args.paginationOpts);
      }

      return ctx.db
        .query("schoolAssessments")
        .withIndex("by_schoolId_and_classId_and_status_and_order", (q) =>
          q
            .eq("schoolId", args.schoolId)
            .eq("classId", classData._id)
            .eq("status", "published")
        )
        .paginate(args.paginationOpts);
    }

    await requirePermission(ctx, "assessment:update", {
      userId: user.appUser._id,
      schoolId: args.schoolId,
    });

    return ctx.db
      .query("schoolAssessments")
      .withIndex("by_schoolId_and_order", (q) =>
        q.eq("schoolId", args.schoolId)
      )
      .paginate(args.paginationOpts);
  },
});
