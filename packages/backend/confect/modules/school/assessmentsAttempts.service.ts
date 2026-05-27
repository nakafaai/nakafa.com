import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import {
  getAttemptExpiry,
  requireAccessibleAssignment,
} from "@repo/backend/confect/modules/school/assessments.shared";
import { Clock, Effect } from "effect";

/** Loads one assignment that is available to the current student/class. */
export const getAssignment = Effect.fn("assessments.getAssignment")(
  function* (args: {
    readonly assignmentId: Id<"schoolAssessmentAssignments">;
    readonly classId: Id<"schoolClasses">;
  }) {
    const ctx = yield* QueryCtx;
    const user = yield* requireAppUser(ctx);
    return yield* requireAccessibleAssignment(
      ctx,
      args.assignmentId,
      args.classId,
      user.appUser._id
    );
  }
);

/** Computes the next student attempt number for an assignment. */
const getNextAttemptNumber = Effect.fn("assessments.getNextAttemptNumber")(
  function* (
    assignmentId: Id<"schoolAssessmentAssignments">,
    studentId: Id<"users">
  ) {
    const ctx = yield* MutationCtx;
    const latestAttempt = yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessmentAttempts")
        .withIndex("by_assignmentId_and_studentId_and_attemptNumber", (query) =>
          query.eq("assignmentId", assignmentId).eq("studentId", studentId)
        )
        .order("desc")
        .first()
    );

    return (latestAttempt?.attemptNumber ?? 0) + 1;
  }
);

/** Starts or resumes an in-progress assignment attempt. */
export const startAttempt = Effect.fn("assessments.startAttempt")(
  function* (args: {
    readonly assignmentId: Id<"schoolAssessmentAssignments">;
    readonly classId: Id<"schoolClasses">;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const { assignment, target } = yield* requireAccessibleAssignment(
      ctx,
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

    const inProgressAttempt = yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessmentAttempts")
        .withIndex("by_assignmentId_and_studentId_and_status", (query) =>
          query
            .eq("assignmentId", args.assignmentId)
            .eq("studentId", user.appUser._id)
            .eq("status", "in-progress")
        )
        .unique()
    );

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

    return yield* Effect.promise(() =>
      ctx.db.insert("schoolAssessmentAttempts", {
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
      })
    );
  }
);

/** Saves or replaces a response for one in-progress attempt. */
export const saveResponse = Effect.fn("assessments.saveResponse")(
  function* (args: {
    readonly attemptId: Id<"schoolAssessmentAttempts">;
    readonly essayAttachmentStorageIds?: readonly Id<"_storage">[];
    readonly essayContent?: Doc<"schoolAssessmentResponses">["essayContent"];
    readonly isFinal: boolean;
    readonly questionId: Id<"schoolAssessmentVersionQuestions">;
    readonly questionType: Doc<"schoolAssessmentResponses">["questionType"];
    readonly selectedChoiceIds?: readonly Id<"schoolAssessmentVersionChoices">[];
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const attempt = yield* Effect.promise(() => ctx.db.get(args.attemptId));
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

    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessmentResponses")
        .withIndex("by_attemptId_and_questionId", (query) =>
          query
            .eq("attemptId", args.attemptId)
            .eq("questionId", args.questionId)
        )
        .unique()
    );

    if (existing) {
      yield* Effect.promise(() =>
        ctx.db.patch(existing._id, {
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
        })
      );
      return existing._id;
    }

    return yield* Effect.promise(() =>
      ctx.db.insert("schoolAssessmentResponses", {
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
      })
    );
  }
);

/** Submits an attempt and performs automatic scoring where possible. */
export const submitAttempt = Effect.fn("assessments.submitAttempt")(
  function* (args: { readonly attemptId: Id<"schoolAssessmentAttempts"> }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const attempt = yield* Effect.promise(() => ctx.db.get(args.attemptId));

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

    const assignment = yield* Effect.promise(() =>
      ctx.db.get(attempt.assignmentId)
    );

    if (!assignment) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "ASSIGNMENT_NOT_FOUND",
          message: `Expected assignment for attemptId: ${args.attemptId}`,
        })
      );
    }

    const responses = yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessmentResponses")
        .withIndex("by_attemptId_and_questionId", (query) =>
          query.eq("attemptId", args.attemptId)
        )
        .collect()
    );
    let autoScore = 0;

    for (const response of responses) {
      const score = yield* scoreAutoResponse(response);
      autoScore += score;
    }

    let hasEssayQuestions = false;

    if (assignment.gradingMode === "hybrid") {
      const versionQuestions = yield* Effect.promise(() =>
        ctx.db
          .query("schoolAssessmentVersionQuestions")
          .withIndex("by_versionId_and_sectionId_and_order", (query) =>
            query.eq("versionId", attempt.versionId)
          )
          .collect()
      );
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

    yield* Effect.promise(() =>
      ctx.db.patch(args.attemptId, {
        completedAt: submittedAt,
        gradingStatus,
        score: autoScore,
        status: "submitted",
        submittedAt,
      })
    );

    return null;
  }
);

/** Scores one non-essay response and patches its auto score. */
const scoreAutoResponse = Effect.fn("assessments.scoreAutoResponse")(function* (
  response: Doc<"schoolAssessmentResponses">
) {
  const ctx = yield* MutationCtx;

  if (
    response.questionType === "essay" ||
    !response.selectedChoiceIds ||
    response.selectedChoiceIds.length === 0
  ) {
    return 0;
  }

  const question = yield* Effect.promise(() => ctx.db.get(response.questionId));
  const choices = yield* Effect.promise(() =>
    ctx.db
      .query("schoolAssessmentVersionChoices")
      .withIndex("by_questionId_and_order", (query) =>
        query.eq("questionId", response.questionId)
      )
      .collect()
  );

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

  yield* Effect.promise(() => ctx.db.patch(response._id, { autoScore }));

  return autoScore;
});
