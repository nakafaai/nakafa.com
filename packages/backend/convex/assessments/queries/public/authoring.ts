import { query } from "@repo/backend/convex/_generated/server";
import { loadAuthoredAssessment } from "@repo/backend/convex/assessments/helpers/authoring";
import { authoredAssessmentValidator } from "@repo/backend/convex/assessments/validators";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
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
    const authored = await loadAuthoredAssessment(ctx, args.assessmentId);

    if (!authored || authored.assessment.schoolId !== args.schoolId) {
      return null;
    }

    await requirePermission(ctx, "assessment:update", {
      userId: user.appUser._id,
      schoolId: authored.assessment.schoolId,
      classId: authored.assessment.classId,
    });

    return authored;
  },
});
