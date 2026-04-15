import { requireAssessment } from "@repo/backend/convex/assessments/helpers/access";
import { requireRichContentSize } from "@repo/backend/convex/assessments/helpers/content";
import { richContentValidator } from "@repo/backend/convex/assessments/schema";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { v } from "convex/values";

/** Create one authored section inside one draft assessment. */
export const createSection = mutation({
  args: {
    schoolId: v.id("schools"),
    assessmentId: v.id("schoolAssessments"),
    title: v.string(),
    description: v.optional(richContentValidator),
    durationMinutes: v.optional(v.number()),
  },
  returns: v.id("schoolAssessmentSections"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const assessment = await requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );

    await requirePermission(ctx, "assessment:update", {
      userId: user.appUser._id,
      schoolId: assessment.schoolId,
      classId: assessment.classId,
    });

    if (args.description) {
      requireRichContentSize(args.description, "Section description");
    }

    const lastSection = await ctx.db
      .query("schoolAssessmentSections")
      .withIndex("by_assessmentId_and_order", (q) =>
        q.eq("assessmentId", args.assessmentId)
      )
      .order("desc")
      .first();

    return ctx.db.insert("schoolAssessmentSections", {
      schoolId: args.schoolId,
      assessmentId: args.assessmentId,
      title: args.title,
      description: args.description,
      order: (lastSection?.order ?? -1) + 1,
      durationMinutes: args.durationMinutes,
    });
  },
});
