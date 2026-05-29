import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import {
  getNextAssessmentVersionNumber,
  getTotalVersionPoints,
  loadAuthoredAssessment,
  requireAssessment,
} from "@repo/backend/confect/modules/school/assessments.shared";
import { requirePermission } from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import { Clock, Effect } from "effect";

/** Creates an immutable assessment version from current authoring rows. */
export const createAssessmentVersion = Effect.fnUntraced(function* (args: {
  readonly assessmentId: Id<"schoolAssessments">;
  readonly gradingMode: Doc<"schoolAssessmentVersions">["gradingMode"];
  readonly instructions?: Doc<"schoolAssessmentVersions">["instructions"];
  readonly monitoringMode: Doc<"schoolAssessmentVersions">["monitoringMode"];
  readonly rankingScope: Doc<"schoolAssessmentVersions">["rankingScope"];
  readonly releaseMode: Doc<"schoolAssessmentVersions">["releaseMode"];
  readonly retakePolicy: Doc<"schoolAssessmentVersions">["retakePolicy"];
  readonly schoolId: Id<"schools">;
  readonly timingPolicy: Doc<"schoolAssessmentVersions">["timingPolicy"];
}) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const assessment = yield* requireAssessment(args.schoolId, args.assessmentId);

  yield* requirePermission(PERMISSIONS.ASSESSMENT_PUBLISH, {
    classId: assessment.classId,
    schoolId: assessment.schoolId,
    userId: user.appUser._id,
  });

  const authored = yield* loadAuthoredAssessment(args.assessmentId);

  if (!authored) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "ASSESSMENT_NOT_FOUND",
        message: "Expected authored assessment tree to exist.",
      })
    );
  }

  const now = yield* Clock.currentTimeMillis;
  const versionNumber = yield* getNextAssessmentVersionNumber(
    args.assessmentId
  );
  const versionId = yield* writer.table("schoolAssessmentVersions").insert({
    assessmentId: args.assessmentId,
    createdAt: now,
    createdBy: user.appUser._id,
    description: assessment.description,
    gradingMode: args.gradingMode,
    instructions: args.instructions,
    mode: assessment.mode,
    monitoringMode: args.monitoringMode,
    rankingScope: args.rankingScope,
    releaseMode: args.releaseMode,
    retakePolicy: args.retakePolicy,
    schoolId: args.schoolId,
    timingPolicy: args.timingPolicy,
    title: assessment.title,
    totalPoints: getTotalVersionPoints(authored.questions),
    totalQuestionCount: authored.questions.length,
    versionNumber,
  });
  const versionSectionIds = new Map<
    Id<"schoolAssessmentSections">,
    Id<"schoolAssessmentVersionSections">
  >();

  for (const section of authored.sections) {
    const sectionQuestions = authored.questions.filter(
      (question) => question.sectionId === section._id
    );
    const versionSectionId = yield* writer
      .table("schoolAssessmentVersionSections")
      .insert({
        assessmentId: args.assessmentId,
        description: section.description,
        durationMinutes: section.durationMinutes,
        order: section.order,
        questionCount: sectionQuestions.length,
        schoolId: args.schoolId,
        sourceSectionId: section._id,
        title: section.title,
        totalPoints: getTotalVersionPoints(sectionQuestions),
        versionId,
      });
    versionSectionIds.set(section._id, versionSectionId);
  }

  const versionQuestionIds = new Map<
    Id<"schoolAssessmentQuestions">,
    Id<"schoolAssessmentVersionQuestions">
  >();

  for (const question of authored.questions) {
    const sectionId = versionSectionIds.get(question.sectionId);

    if (!sectionId) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "INVALID_ASSESSMENT_TREE",
          message: "Assessment question is missing its section.",
        })
      );
    }

    const versionQuestionId = yield* writer
      .table("schoolAssessmentVersionQuestions")
      .insert({
        assessmentId: args.assessmentId,
        bankEntryId: question.bankEntryId,
        choiceCount: question.choiceCount,
        explanation: question.explanation,
        maxSelectionCount: question.maxSelectionCount,
        order: question.order,
        points: question.points,
        questionType: question.questionType,
        required: question.required,
        rubricCriterionCount: question.rubricCriterionCount,
        schoolId: args.schoolId,
        sectionId,
        shuffleChoices: question.shuffleChoices,
        source: question.source,
        sourceQuestionId: question._id,
        stem: question.stem,
        versionId,
      });
    versionQuestionIds.set(question._id, versionQuestionId);
  }

  for (const choice of authored.choices) {
    const questionId = versionQuestionIds.get(choice.questionId);

    if (!questionId) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "INVALID_ASSESSMENT_TREE",
          message: "Assessment choice is missing its question.",
        })
      );
    }

    yield* writer.table("schoolAssessmentVersionChoices").insert({
      assessmentId: args.assessmentId,
      content: choice.content,
      isCorrect: choice.isCorrect,
      key: choice.key,
      order: choice.order,
      questionId,
      schoolId: args.schoolId,
      sourceChoiceId: choice._id,
      versionId,
    });
  }

  for (const criterion of authored.rubricCriteria) {
    const questionId = versionQuestionIds.get(criterion.questionId);

    if (!questionId) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "INVALID_ASSESSMENT_TREE",
          message: "Assessment rubric criterion is missing its question.",
        })
      );
    }

    yield* writer.table("schoolAssessmentVersionRubricCriteria").insert({
      assessmentId: args.assessmentId,
      description: criterion.description,
      label: criterion.label,
      maxScore: criterion.maxScore,
      order: criterion.order,
      questionId,
      schoolId: args.schoolId,
      sourceCriterionId: criterion._id,
      versionId,
    });
  }

  const isNewlyPublished = assessment.status !== "published";

  yield* writer.table("schoolAssessments").patch(args.assessmentId, {
    currentVersionId: versionId,
    publishedAt: isNewlyPublished ? now : assessment.publishedAt,
    publishedBy: isNewlyPublished ? user.appUser._id : assessment.publishedBy,
    scheduledAt: undefined,
    scheduledJobId: undefined,
    status: "published",
    updatedAt: now,
    updatedBy: user.appUser._id,
  });

  return versionId;
});
