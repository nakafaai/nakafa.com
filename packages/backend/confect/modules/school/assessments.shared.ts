import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type {
  MutationCtx as ConvexMutationCtx,
  QueryCtx as ConvexQueryCtx,
} from "@repo/backend/confect/_generated/services";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import { requireClassAccess } from "@repo/backend/confect/modules/school/classAccess.service";
import { Effect } from "effect";

type DatabaseCtx = ConvexMutationCtx | ConvexQueryCtx;

interface RichContent {
  readonly format: "plate-v1";
  readonly json: string;
  readonly text: string;
}

/** Requires an assessment to exist inside a school. */
export const requireAssessment = Effect.fn("assessments.requireAssessment")(
  function* (
    ctx: DatabaseCtx,
    schoolId: Id<"schools">,
    assessmentId: Id<"schoolAssessments">
  ) {
    const assessment = yield* Effect.promise(() => ctx.db.get(assessmentId));

    if (assessment?.schoolId === schoolId) {
      return assessment;
    }

    return yield* Effect.fail(
      new AssessmentError({
        code: "ASSESSMENT_NOT_FOUND",
        message: `Assessment not found for assessmentId: ${assessmentId}`,
      })
    );
  }
);

/** Validates rich content size before persisting it. */
export function requireRichContentSize(
  content: RichContent,
  fieldName: string
) {
  if (content.json.length === 0) {
    return Effect.fail(
      new AssessmentError({
        code: "INVALID_RICH_CONTENT",
        message: `${fieldName} JSON content is required.`,
      })
    );
  }

  if (content.text.length <= 2e4) {
    return Effect.succeed(null);
  }

  return Effect.fail(
    new AssessmentError({
      code: "INVALID_RICH_CONTENT",
      message: `${fieldName} text content is too large.`,
    })
  );
}

/** Validates scheduled publication state against the current time. */
export function validateScheduledStatus(
  status: "archived" | "draft" | "published" | "scheduled",
  scheduledAt: number | undefined,
  now: number
) {
  if (status !== "scheduled") {
    return Effect.succeed(null);
  }

  if (!scheduledAt) {
    return Effect.fail(
      new AssessmentError({
        code: "INVALID_ASSESSMENT_STATUS",
        message: "Scheduled assessments require a publish timestamp.",
      })
    );
  }

  if (scheduledAt > now) {
    return Effect.succeed(null);
  }

  return Effect.fail(
    new AssessmentError({
      code: "INVALID_ASSESSMENT_STATUS",
      message: "Scheduled assessments require a future publish timestamp.",
    })
  );
}

/** Loads all editable authoring rows for an assessment. */
export const loadAuthoredAssessment = Effect.fn(
  "assessments.loadAuthoredAssessment"
)(function* (ctx: DatabaseCtx, assessmentId: Id<"schoolAssessments">) {
  const assessment = yield* Effect.promise(() => ctx.db.get(assessmentId));

  if (!assessment) {
    return null;
  }

  const currentVersionId = assessment.currentVersionId;
  const currentVersion = currentVersionId
    ? yield* Effect.promise(() => ctx.db.get(currentVersionId))
    : null;
  const sections = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentSections")
      .withIndex("by_assessmentId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const questions = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentQuestions")
      .withIndex("by_assessmentId_and_sectionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const choices = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentChoices")
      .withIndex("by_assessmentId_and_questionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );
  const rubricCriteria = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentRubricCriteria")
      .withIndex("by_assessmentId_and_questionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect()
  );

  return {
    assessment,
    choices,
    currentVersion,
    questions,
    rubricCriteria,
    sections,
  };
});

/** Computes the next immutable version number for an assessment. */
export const getNextAssessmentVersionNumber = Effect.fn(
  "assessments.getNextVersionNumber"
)(function* (ctx: DatabaseCtx, assessmentId: Id<"schoolAssessments">) {
  const latestVersion = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentVersions")
      .withIndex("by_assessmentId_and_versionNumber", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .order("desc")
      .first()
  );

  return (latestVersion?.versionNumber ?? 0) + 1;
});

/** Sums total points for assessment questions. */
export function getTotalVersionPoints(
  questions: readonly { readonly points: number }[]
) {
  return questions.reduce((total, question) => total + question.points, 0);
}

/** Lists question banks visible at school or class scope. */
export const listVisibleQuestionBanks = Effect.fn(
  "assessments.listVisibleQuestionBanks"
)(function* (
  ctx: DatabaseCtx,
  schoolId: Id<"schools">,
  classId?: Id<"schoolClasses">
) {
  const schoolBanks = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentQuestionBanks")
      .withIndex("by_schoolId_and_scope", (query) =>
        query.eq("schoolId", schoolId).eq("scope", "school")
      )
      .collect()
  );

  if (!classId) {
    return schoolBanks;
  }

  const classBanks = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentQuestionBanks")
      .withIndex("by_schoolId_and_classId", (query) =>
        query.eq("schoolId", schoolId).eq("classId", classId)
      )
      .collect()
  );

  return [...schoolBanks, ...classBanks];
});

/** Requires an assignment target row for a class. */
export const requireAssignmentTarget = Effect.fn(
  "assessments.requireAssignmentTarget"
)(function* (
  ctx: DatabaseCtx,
  assignmentId: Id<"schoolAssessmentAssignments">,
  classId: Id<"schoolClasses">
) {
  const target = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentAssignmentTargets")
      .withIndex("by_assignmentId_and_classId", (query) =>
        query.eq("assignmentId", assignmentId).eq("classId", classId)
      )
      .unique()
  );

  if (target) {
    return target;
  }

  return yield* Effect.fail(
    new AssessmentError({
      code: "ASSIGNMENT_TARGET_NOT_FOUND",
      message: "Assignment is not available for this class.",
    })
  );
});

/** Loads an assignment and verifies class access. */
export const requireAccessibleAssignment = Effect.fn(
  "assessments.requireAccessibleAssignment"
)(function* (
  ctx: DatabaseCtx,
  assignmentId: Id<"schoolAssessmentAssignments">,
  classId: Id<"schoolClasses">,
  userId: Id<"users">
) {
  const assignment = yield* Effect.promise(() => ctx.db.get(assignmentId));

  if (!assignment) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ASSIGNMENT_NOT_FOUND",
        message: `Assignment not found for assignmentId: ${assignmentId}`,
      })
    );
  }

  yield* requireClassAccess(ctx, classId, assignment.schoolId, userId);
  const target = yield* requireAssignmentTarget(ctx, assignmentId, classId);

  return { assignment, target };
});

/** Computes the attempt expiry for assignment timing policy. */
export function getAttemptExpiry(
  assignment: Doc<"schoolAssessmentAssignments">,
  startedAt: number
) {
  if (!assignment.timingPolicy.durationMinutes) {
    return assignment.closesAt;
  }

  const durationExpiresAt =
    startedAt + assignment.timingPolicy.durationMinutes * 60 * 1e3;

  if (!assignment.closesAt) {
    return durationExpiresAt;
  }

  return Math.min(durationExpiresAt, assignment.closesAt);
}
