import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import { requireClassAccess } from "@repo/backend/confect/modules/school/classAccess.service";
import { Effect, Option } from "effect";

interface RichContent {
  readonly format: "plate-v1";
  readonly json: string;
  readonly text: string;
}

/** Requires an assessment to exist inside a school. */
export const requireAssessment = Effect.fn("assessments.requireAssessment")(
  function* (schoolId: Id<"schools">, assessmentId: Id<"schoolAssessments">) {
    const reader = yield* DatabaseReader;
    const assessment = yield* reader
      .table("schoolAssessments")
      .get(assessmentId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
)(function* (assessmentId: Id<"schoolAssessments">) {
  const reader = yield* DatabaseReader;
  const assessment = yield* reader
    .table("schoolAssessments")
    .get(assessmentId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!assessment) {
    return null;
  }

  const currentVersionId = assessment.currentVersionId;
  const currentVersion = currentVersionId
    ? yield* reader
        .table("schoolAssessmentVersions")
        .get(currentVersionId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)))
    : null;
  const [sections, questions, choices, rubricCriteria] = yield* Effect.all([
    reader
      .table("schoolAssessmentSections")
      .index("by_assessmentId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect(),
    reader
      .table("schoolAssessmentQuestions")
      .index("by_assessmentId_and_sectionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect(),
    reader
      .table("schoolAssessmentChoices")
      .index("by_assessmentId_and_questionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect(),
    reader
      .table("schoolAssessmentRubricCriteria")
      .index("by_assessmentId_and_questionId_and_order", (query) =>
        query.eq("assessmentId", assessmentId)
      )
      .collect(),
  ]);

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
)(function* (assessmentId: Id<"schoolAssessments">) {
  const reader = yield* DatabaseReader;
  const latestVersion = yield* reader
    .table("schoolAssessmentVersions")
    .index(
      "by_assessmentId_and_versionNumber",
      (query) => query.eq("assessmentId", assessmentId),
      "desc"
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

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
)(function* (schoolId: Id<"schools">, classId?: Id<"schoolClasses">) {
  const reader = yield* DatabaseReader;
  const schoolBanks = yield* reader
    .table("schoolAssessmentQuestionBanks")
    .index("by_schoolId_and_scope", (query) =>
      query.eq("schoolId", schoolId).eq("scope", "school")
    )
    .collect();

  if (!classId) {
    return schoolBanks;
  }

  const classBanks = yield* reader
    .table("schoolAssessmentQuestionBanks")
    .index("by_schoolId_and_classId", (query) =>
      query.eq("schoolId", schoolId).eq("classId", classId)
    )
    .collect();

  return [...schoolBanks, ...classBanks];
});

/** Requires an assignment target row for a class. */
export const requireAssignmentTarget = Effect.fn(
  "assessments.requireAssignmentTarget"
)(function* (
  assignmentId: Id<"schoolAssessmentAssignments">,
  classId: Id<"schoolClasses">
) {
  const reader = yield* DatabaseReader;
  const target = yield* reader
    .table("schoolAssessmentAssignmentTargets")
    .index("by_assignmentId_and_classId", (query) =>
      query.eq("assignmentId", assignmentId).eq("classId", classId)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

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
  assignmentId: Id<"schoolAssessmentAssignments">,
  classId: Id<"schoolClasses">,
  userId: Id<"users">
) {
  const reader = yield* DatabaseReader;
  const assignment = yield* reader
    .table("schoolAssessmentAssignments")
    .get(assignmentId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!assignment) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ASSIGNMENT_NOT_FOUND",
        message: `Assignment not found for assignmentId: ${assignmentId}`,
      })
    );
  }

  yield* requireClassAccess(classId, assignment.schoolId, userId);
  const target = yield* requireAssignmentTarget(assignmentId, classId);

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
