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
    status: v.optional(
      v.union(v.literal("draft"), v.literal("published"), v.literal("archived"))
    ),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedSchoolAssessmentsValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requirePermission(ctx, "assessment:update", {
      userId: user.appUser._id,
      schoolId: args.schoolId,
    });

    const status = args.status ?? "draft";

    if (args.classId) {
      return ctx.db
        .query("schoolAssessments")
        .withIndex("by_schoolId_and_classId_and_status", (q) =>
          q
            .eq("schoolId", args.schoolId)
            .eq("classId", args.classId)
            .eq("status", status)
        )
        .paginate(args.paginationOpts);
    }

    return ctx.db
      .query("schoolAssessments")
      .withIndex("by_schoolId_and_status", (q) =>
        q.eq("schoolId", args.schoolId).eq("status", status)
      )
      .paginate(args.paginationOpts);
  },
});
