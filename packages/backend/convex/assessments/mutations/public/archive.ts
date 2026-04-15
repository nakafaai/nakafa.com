import {
  requireAssessment,
  requireAssessmentPermission,
} from "@repo/backend/convex/assessments/helpers/access";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { v } from "convex/values";

/** Archive one authored assessment and prevent further editing. */
export const archiveAssessment = mutation({
  args: {
    schoolId: v.id("schools"),
    assessmentId: v.id("schoolAssessments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requireAssessmentPermission(
      ctx,
      user.appUser._id,
      args.schoolId,
      "assessment:archive"
    );

    await requireAssessment(ctx, args.schoolId, args.assessmentId);

    await ctx.db.patch("schoolAssessments", args.assessmentId, {
      status: "archived",
      archivedBy: user.appUser._id,
      archivedAt: Date.now(),
      updatedBy: user.appUser._id,
      updatedAt: Date.now(),
    });

    return null;
  },
});
