import { query } from "@repo/backend/convex/_generated/server";
import { paginatedSchoolAssessmentsValidator } from "@repo/backend/convex/assessments/validators";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

/** List authored assessments visible to teachers in one school scope. */
export const listAssessments = query({
  args: {
    schoolId: v.id("schools"),
    classId: v.optional(v.id("schoolClasses")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedSchoolAssessmentsValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requirePermission(ctx, "assessment:update", {
      userId: user.appUser._id,
      schoolId: args.schoolId,
    });

    if (args.classId) {
      const results = await ctx.db
        .query("schoolAssessments")
        .withIndex("by_schoolId_and_classId_and_updatedAt", (q) =>
          q.eq("schoolId", args.schoolId).eq("classId", args.classId)
        )
        .order("desc")
        .paginate(args.paginationOpts);

      return {
        ...results,
        page: results.page.filter(
          (assessment) => assessment.status !== "archived"
        ),
      };
    }

    const results = await ctx.db
      .query("schoolAssessments")
      .withIndex("by_schoolId_and_updatedAt", (q) =>
        q.eq("schoolId", args.schoolId)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...results,
      page: results.page.filter(
        (assessment) => assessment.status !== "archived"
      ),
    };
  },
});
