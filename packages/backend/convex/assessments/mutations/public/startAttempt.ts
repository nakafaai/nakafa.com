import {
  getAttemptExpiry,
  getNextAttemptNumber,
  requireAccessibleAssignment,
} from "@repo/backend/convex/assessments/helpers/attempts";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { ConvexError, v } from "convex/values";

/** Start one new attempt for the current student against one assignment target. */
export const startAttempt = mutation({
  args: {
    assignmentId: v.id("schoolAssessmentAssignments"),
    classId: v.id("schoolClasses"),
  },
  returns: v.id("schoolAssessmentAttempts"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const { assignment, target } = await requireAccessibleAssignment(
      ctx,
      args.assignmentId,
      args.classId,
      user.appUser._id
    );

    const now = Date.now();

    if (assignment.opensAt && assignment.opensAt > now) {
      throw new ConvexError({
        code: "ASSIGNMENT_NOT_OPEN",
        message: "This assignment is not open yet.",
      });
    }

    if (assignment.closesAt && assignment.closesAt < now) {
      throw new ConvexError({
        code: "ASSIGNMENT_CLOSED",
        message: "This assignment is already closed.",
      });
    }

    const inProgressAttempt = await ctx.db
      .query("schoolAssessmentAttempts")
      .withIndex("by_studentId_and_assignmentId", (q) =>
        q
          .eq("studentId", user.appUser._id)
          .eq("assignmentId", args.assignmentId)
      )
      .filter((q) => q.eq(q.field("status"), "in-progress"))
      .first();

    if (inProgressAttempt) {
      return inProgressAttempt._id;
    }

    const attemptNumber = await getNextAttemptNumber(
      ctx,
      args.assignmentId,
      user.appUser._id
    );

    if (!assignment.retakePolicy.allowRetake && attemptNumber > 1) {
      throw new ConvexError({
        code: "ATTEMPT_LIMIT_REACHED",
        message: "Retakes are disabled for this assignment.",
      });
    }

    if (
      assignment.retakePolicy.maxAttempts &&
      attemptNumber > assignment.retakePolicy.maxAttempts
    ) {
      throw new ConvexError({
        code: "ATTEMPT_LIMIT_REACHED",
        message: "Maximum attempts reached for this assignment.",
      });
    }

    return ctx.db.insert("schoolAssessmentAttempts", {
      schoolId: assignment.schoolId,
      classId: args.classId,
      assignmentId: assignment._id,
      targetId: target._id,
      assessmentId: assignment.assessmentId,
      versionId: assignment.versionId,
      studentId: user.appUser._id,
      status: "in-progress",
      gradingStatus:
        assignment.gradingMode === "auto" ? "auto-graded" : "pending",
      attemptNumber,
      startedAt: now,
      expiresAt: getAttemptExpiry(assignment, now),
    });
  },
});
