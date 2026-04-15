import { query } from "@repo/backend/convex/_generated/server";
import { requireAssessmentPermission } from "@repo/backend/convex/assessments/helpers/access";
import { loadAuthoredAssessment } from "@repo/backend/convex/assessments/helpers/authoring";
import { authoredAssessmentValidator } from "@repo/backend/convex/assessments/validators";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/** Load one authored assessment tree for teacher-facing editing screens. */
export const getAuthoredAssessment = query({
  args: {
    schoolId: vv.id("schools"),
    assessmentId: vv.id("schoolAssessments"),
  },
  returns: v.union(authoredAssessmentValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requireAssessmentPermission(
      ctx,
      user.appUser._id,
      args.schoolId,
      "assessment:update"
    );

    return loadAuthoredAssessment(ctx, args.assessmentId);
  },
});
