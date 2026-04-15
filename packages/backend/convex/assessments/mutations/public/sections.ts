import {
  requireAssessment,
  requireAssessmentPermission,
} from "@repo/backend/convex/assessments/helpers/access";
import { requireRichContentSize } from "@repo/backend/convex/assessments/helpers/richContent";
import { richContentValidator } from "@repo/backend/convex/assessments/schema";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
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

    await requireAssessmentPermission(
      ctx,
      user.appUser._id,
      args.schoolId,
      "assessment:update"
    );

    await requireAssessment(ctx, args.schoolId, args.assessmentId);

    if (args.description) {
      requireRichContentSize(args.description, "Section description");
    }

    const existing = await ctx.db
      .query("schoolAssessmentSections")
      .withIndex("by_assessmentId_and_order", (q) =>
        q.eq("assessmentId", args.assessmentId)
      )
      .collect();

    return ctx.db.insert("schoolAssessmentSections", {
      schoolId: args.schoolId,
      assessmentId: args.assessmentId,
      title: args.title,
      description: args.description,
      order: existing.length,
      durationMinutes: args.durationMinutes,
    });
  },
});
