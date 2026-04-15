import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { requireClassAccess } from "@repo/backend/convex/lib/helpers/class";
import { ConvexError } from "convex/values";

/** Require one assignment target row for a class-scoped delivery. */
export async function requireAssignmentTarget(
  ctx: QueryCtx | MutationCtx,
  assignmentId: Id<"schoolAssessmentAssignments">,
  classId: Id<"schoolClasses">
) {
  const target = await ctx.db
    .query("schoolAssessmentAssignmentTargets")
    .withIndex("by_assignmentId_and_classId", (q) =>
      q.eq("assignmentId", assignmentId).eq("classId", classId)
    )
    .unique();

  if (!target) {
    throw new ConvexError({
      code: "ASSIGNMENT_TARGET_NOT_FOUND",
      message: "Assignment is not available for this class.",
    });
  }

  return target;
}

/** Require one assignment and its target class access. */
export async function requireAccessibleAssignment(
  ctx: QueryCtx | MutationCtx,
  assignmentId: Id<"schoolAssessmentAssignments">,
  classId: Id<"schoolClasses">,
  userId: Id<"users">
) {
  const assignment = await ctx.db.get(
    "schoolAssessmentAssignments",
    assignmentId
  );

  if (!assignment) {
    throw new ConvexError({
      code: "ASSIGNMENT_NOT_FOUND",
      message: `Assignment not found for assignmentId: ${assignmentId}`,
    });
  }

  await requireClassAccess(ctx, classId, assignment.schoolId, userId);

  const target = await requireAssignmentTarget(ctx, assignmentId, classId);

  return { assignment, target };
}

/** Compute the next attempt number for one student and assignment. */
export async function getNextAttemptNumber(
  ctx: QueryCtx | MutationCtx,
  assignmentId: Id<"schoolAssessmentAssignments">,
  studentId: Id<"users">
) {
  const latestAttempt = await ctx.db
    .query("schoolAssessmentAttempts")
    .withIndex("by_assignmentId_and_studentId_and_attemptNumber", (q) =>
      q.eq("assignmentId", assignmentId).eq("studentId", studentId)
    )
    .order("desc")
    .first();

  return (latestAttempt?.attemptNumber ?? 0) + 1;
}

/** Compute one attempt expiry timestamp from the current assignment policy. */
export function getAttemptExpiry(
  assignment: Doc<"schoolAssessmentAssignments">,
  startedAt: number
) {
  if (!assignment.timingPolicy.durationMinutes) {
    return assignment.closesAt;
  }

  const durationExpiresAt =
    startedAt + assignment.timingPolicy.durationMinutes * 60 * 1000;

  if (!assignment.closesAt) {
    return durationExpiresAt;
  }

  return Math.min(durationExpiresAt, assignment.closesAt);
}
