import { query } from "@repo/backend/convex/_generated/server";
import { requireAccessibleAssignment } from "@repo/backend/convex/assessments/helpers/attempts";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/** Load one class-scoped assignment shell for student or teacher entry screens. */
export const getAssignment = query({
  args: {
    assignmentId: vv.id("schoolAssessmentAssignments"),
    classId: vv.id("schoolClasses"),
  },
  returns: v.object({
    assignment: vv.doc("schoolAssessmentAssignments"),
    target: vv.doc("schoolAssessmentAssignmentTargets"),
  }),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    return requireAccessibleAssignment(
      ctx,
      args.assignmentId,
      args.classId,
      user.appUser._id
    );
  },
});
