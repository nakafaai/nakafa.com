import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import {
  getAttemptExpiry,
  requireAccessibleAssignment,
} from "@repo/backend/confect/modules/school/assessments.shared";
import type { SchoolAssessmentResponses } from "@repo/backend/confect/modules/school/assessmentsTables/delivery";
import { Clock, Effect, Option } from "effect";

/** Loads one assignment that is available to the current student/class. */
export const getAssignment = Effect.fnUntraced(function* (args: {
  readonly assignmentId: Id<"schoolAssessmentAssignments">;
  readonly classId: Id<"schoolClasses">;
}) {
  const user = yield* requireAppUser();
  return yield* requireAccessibleAssignment(
    args.assignmentId,
    args.classId,
    user.appUser._id
  );
});

/** Computes the next student attempt number for an assignment. */
const getNextAttemptNumber = Effect.fnUntraced(function* (
  assignmentId: Id<"schoolAssessmentAssignments">,
  studentId: Id<"users">
) {
  const reader = yield* DatabaseReader;
  const latestAttemptOption = yield* reader
    .table("schoolAssessmentAttempts")
    .index(
      "by_assignmentId_and_studentId_and_attemptNumber",
      (query) =>
        query.eq("assignmentId", assignmentId).eq("studentId", studentId),
      "desc"
    )
    .first();
  const latestAttempt = Option.getOrNull(latestAttemptOption);

  return (latestAttempt?.attemptNumber ?? 0) + 1;
});

/** Starts or resumes an in-progress assignment attempt. */
export const startAttempt = Effect.fnUntraced(function* (args: {
  readonly assignmentId: Id<"schoolAssessmentAssignments">;
  readonly classId: Id<"schoolClasses">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const { assignment, target } = yield* requireAccessibleAssignment(
    args.assignmentId,
    args.classId,
    user.appUser._id
  );
  const now = yield* Clock.currentTimeMillis;

  if (assignment.opensAt && assignment.opensAt > now) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ASSIGNMENT_NOT_OPEN",
        message: "This assignment is not open yet.",
      })
    );
  }

  if (assignment.closesAt && assignment.closesAt < now) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ASSIGNMENT_CLOSED",
        message: "This assignment is already closed.",
      })
    );
  }

  const inProgressAttempt = yield* reader
    .table("schoolAssessmentAttempts")
    .get(
      "by_assignmentId_and_studentId_and_status",
      args.assignmentId,
      user.appUser._id,
      "in-progress"
    )
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (inProgressAttempt) {
    return inProgressAttempt._id;
  }

  const attemptNumber = yield* getNextAttemptNumber(
    args.assignmentId,
    user.appUser._id
  );

  if (!assignment.retakePolicy.allowRetake && attemptNumber > 1) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ATTEMPT_LIMIT_REACHED",
        message: "Retakes are disabled for this assignment.",
      })
    );
  }

  if (
    assignment.retakePolicy.maxAttempts &&
    attemptNumber > assignment.retakePolicy.maxAttempts
  ) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ATTEMPT_LIMIT_REACHED",
        message: "Maximum attempts reached for this assignment.",
      })
    );
  }

  return yield* writer.table("schoolAssessmentAttempts").insert({
    assessmentId: assignment.assessmentId,
    assignmentId: assignment._id,
    attemptNumber,
    classId: args.classId,
    expiresAt: getAttemptExpiry(assignment, now),
    gradingStatus:
      assignment.gradingMode === "auto" ? "auto-graded" : "pending",
    schoolId: assignment.schoolId,
    startedAt: now,
    status: "in-progress",
    studentId: user.appUser._id,
    targetId: target._id,
    versionId: assignment.versionId,
  });
});

/** Saves or replaces a response for one in-progress attempt. */
export const saveResponse = Effect.fnUntraced(function* (args: {
  readonly attemptId: Id<"schoolAssessmentAttempts">;
  readonly essayAttachmentStorageIds?: readonly Id<"_storage">[];
  readonly essayContent?: Doc<"schoolAssessmentResponses">["essayContent"];
  readonly isFinal: boolean;
  readonly questionId: Id<"schoolAssessmentVersionQuestions">;
  readonly questionType: Doc<"schoolAssessmentResponses">["questionType"];
  readonly selectedChoiceIds?: readonly Id<"schoolAssessmentVersionChoices">[];
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const attempt = yield* reader
    .table("schoolAssessmentAttempts")
    .get(args.attemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
  const now = yield* Clock.currentTimeMillis;

  if (!attempt || attempt.studentId !== user.appUser._id) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Attempt not found for the current user.",
      })
    );
  }

  if (attempt.status !== "in-progress") {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ATTEMPT_NOT_EDITABLE",
        message: "Only in-progress attempts can accept answers.",
      })
    );
  }

  const existing = yield* reader
    .table("schoolAssessmentResponses")
    .get("by_attemptId_and_questionId", args.attemptId, args.questionId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

  if (existing) {
    yield* writer.table("schoolAssessmentResponses").patch(existing._id, {
      essayAttachmentStorageIds: args.essayAttachmentStorageIds
        ? [...args.essayAttachmentStorageIds]
        : undefined,
      essayContent: args.essayContent,
      isFinal: args.isFinal,
      questionType: args.questionType,
      selectedChoiceIds: args.selectedChoiceIds
        ? [...args.selectedChoiceIds]
        : undefined,
      submittedAt: now,
    });
    return existing._id;
  }

  return yield* writer.table("schoolAssessmentResponses").insert({
    assignmentId: attempt.assignmentId,
    attemptId: attempt._id,
    classId: attempt.classId,
    essayAttachmentStorageIds: args.essayAttachmentStorageIds
      ? [...args.essayAttachmentStorageIds]
      : undefined,
    essayContent: args.essayContent,
    isFinal: args.isFinal,
    questionId: args.questionId,
    questionType: args.questionType,
    schoolId: attempt.schoolId,
    selectedChoiceIds: args.selectedChoiceIds
      ? [...args.selectedChoiceIds]
      : undefined,
    submittedAt: now,
  });
});

/** Submits an attempt and performs automatic scoring where possible. */
export const submitAttempt = Effect.fnUntraced(function* (args: {
  readonly attemptId: Id<"schoolAssessmentAttempts">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const attempt = yield* reader
    .table("schoolAssessmentAttempts")
    .get(args.attemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!attempt || attempt.studentId !== user.appUser._id) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Attempt not found for the current user.",
      })
    );
  }

  if (attempt.status !== "in-progress") {
    return null;
  }

  const assignment = yield* reader
    .table("schoolAssessmentAssignments")
    .get(attempt.assignmentId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!assignment) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ASSIGNMENT_NOT_FOUND",
        message: `Expected assignment for attemptId: ${args.attemptId}`,
      })
    );
  }

  const responses = yield* reader
    .table("schoolAssessmentResponses")
    .index("by_attemptId_and_questionId", (query) =>
      query.eq("attemptId", args.attemptId)
    )
    .collect();
  let autoScore = 0;

  for (const response of responses) {
    const score = yield* scoreAutoResponse(response);
    autoScore += score;
  }

  let hasEssayQuestions = false;

  if (assignment.gradingMode === "hybrid") {
    const versionQuestions = yield* reader
      .table("schoolAssessmentVersionQuestions")
      .index("by_versionId_and_sectionId_and_order", (query) =>
        query.eq("versionId", attempt.versionId)
      )
      .collect();
    hasEssayQuestions = versionQuestions.some(
      (question) => question.questionType === "essay"
    );
  }

  const gradingStatus =
    assignment.gradingMode === "manual" ||
    (assignment.gradingMode === "hybrid" && hasEssayQuestions)
      ? "awaiting-manual-review"
      : "auto-graded";
  const submittedAt = yield* Clock.currentTimeMillis;

  yield* writer.table("schoolAssessmentAttempts").patch(args.attemptId, {
    completedAt: submittedAt,
    gradingStatus,
    score: autoScore,
    status: "submitted",
    submittedAt,
  });

  return null;
});

/** Scores one non-essay response and patches its auto score. */
const scoreAutoResponse = Effect.fnUntraced(function* (
  response: typeof SchoolAssessmentResponses.Doc.Type
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;

  if (
    response.questionType === "essay" ||
    !response.selectedChoiceIds ||
    response.selectedChoiceIds.length === 0
  ) {
    return 0;
  }

  const question = yield* reader
    .table("schoolAssessmentVersionQuestions")
    .get(response.questionId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
  const choices = yield* reader
    .table("schoolAssessmentVersionChoices")
    .index("by_questionId_and_order", (query) =>
      query.eq("questionId", response.questionId)
    )
    .collect();

  if (!question) {
    return 0;
  }

  const correctChoiceIds = choices
    .filter((choice) => choice.isCorrect)
    .map((choice) => choice._id)
    .sort();
  const selectedChoiceIds = [...response.selectedChoiceIds].sort();
  const isCorrect =
    correctChoiceIds.length === selectedChoiceIds.length &&
    correctChoiceIds.every(
      (choiceId, index) => choiceId === selectedChoiceIds[index]
    );
  const autoScore = isCorrect ? question.points : 0;

  yield* writer
    .table("schoolAssessmentResponses")
    .patch(response._id, { autoScore });

  return autoScore;
});
