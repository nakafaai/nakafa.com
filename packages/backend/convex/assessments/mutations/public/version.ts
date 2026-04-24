import { requireAssessment } from "@repo/backend/convex/assessments/helpers/access";
import {
  getNextAssessmentVersionNumber,
  getTotalVersionPoints,
  loadAuthoredAssessment,
} from "@repo/backend/convex/assessments/helpers/authoring";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { v } from "convex/values";

/** Freeze the current authored tree into a new immutable version. */
export const createAssessmentVersion = mutation({
  args: {
    schoolId: v.id("schools"),
    assessmentId: v.id("schoolAssessments"),
    instructions: v.optional(
      v.object({
        format: v.literal("plate-v1"),
        json: v.string(),
        text: v.string(),
      })
    ),
    timingPolicy: v.object({
      durationMinutes: v.optional(v.number()),
      perSection: v.boolean(),
    }),
    gradingMode: v.union(
      v.literal("auto"),
      v.literal("manual"),
      v.literal("hybrid")
    ),
    monitoringMode: v.union(
      v.literal("off"),
      v.literal("basic"),
      v.literal("strict")
    ),
    releaseMode: v.union(
      v.literal("instant"),
      v.literal("manual"),
      v.literal("scheduled")
    ),
    rankingScope: v.union(
      v.literal("none"),
      v.literal("class"),
      v.literal("school")
    ),
    retakePolicy: v.object({
      allowRetake: v.boolean(),
      maxAttempts: v.optional(v.number()),
    }),
  },
  returns: v.id("schoolAssessmentVersions"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const assessment = await requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );

    await requirePermission(ctx, "assessment:publish", {
      userId: user.appUser._id,
      schoolId: assessment.schoolId,
      classId: assessment.classId,
    });

    const authored = await loadAuthoredAssessment(ctx, args.assessmentId);

    if (!authored) {
      throw new Error("Expected authored assessment tree to exist.");
    }

    const now = Date.now();

    const versionNumber = await getNextAssessmentVersionNumber(
      ctx,
      args.assessmentId
    );
    const versionId = await ctx.db.insert("schoolAssessmentVersions", {
      schoolId: args.schoolId,
      assessmentId: args.assessmentId,
      versionNumber,
      title: assessment.title,
      description: assessment.description,
      mode: assessment.mode,
      instructions: args.instructions,
      timingPolicy: args.timingPolicy,
      gradingMode: args.gradingMode,
      monitoringMode: args.monitoringMode,
      releaseMode: args.releaseMode,
      rankingScope: args.rankingScope,
      retakePolicy: args.retakePolicy,
      totalPoints: getTotalVersionPoints(authored.questions),
      totalQuestionCount: authored.questions.length,
      createdBy: user.appUser._id,
      createdAt: now,
    });

    const versionSectionIds = new Map();

    for (const section of authored.sections) {
      const sectionQuestions = authored.questions.filter(
        (question) => question.sectionId === section._id
      );
      const versionSectionId = await ctx.db.insert(
        "schoolAssessmentVersionSections",
        {
          schoolId: args.schoolId,
          assessmentId: args.assessmentId,
          versionId,
          sourceSectionId: section._id,
          title: section.title,
          description: section.description,
          order: section.order,
          durationMinutes: section.durationMinutes,
          questionCount: sectionQuestions.length,
          totalPoints: getTotalVersionPoints(sectionQuestions),
        }
      );

      versionSectionIds.set(section._id, versionSectionId);
    }

    const versionQuestionIds = new Map();

    for (const question of authored.questions) {
      const versionQuestionId = await ctx.db.insert(
        "schoolAssessmentVersionQuestions",
        {
          schoolId: args.schoolId,
          assessmentId: args.assessmentId,
          versionId,
          sourceQuestionId: question._id,
          sectionId: versionSectionIds.get(question.sectionId),
          questionType: question.questionType,
          source: question.source,
          stem: question.stem,
          explanation: question.explanation,
          order: question.order,
          points: question.points,
          required: question.required,
          shuffleChoices: question.shuffleChoices,
          maxSelectionCount: question.maxSelectionCount,
          rubricCriterionCount: question.rubricCriterionCount,
          choiceCount: question.choiceCount,
          bankEntryId: question.bankEntryId,
        }
      );

      versionQuestionIds.set(question._id, versionQuestionId);
    }

    for (const choice of authored.choices) {
      await ctx.db.insert("schoolAssessmentVersionChoices", {
        schoolId: args.schoolId,
        assessmentId: args.assessmentId,
        versionId,
        questionId: versionQuestionIds.get(choice.questionId),
        sourceChoiceId: choice._id,
        key: choice.key,
        content: choice.content,
        order: choice.order,
        isCorrect: choice.isCorrect,
      });
    }

    for (const criterion of authored.rubricCriteria) {
      await ctx.db.insert("schoolAssessmentVersionRubricCriteria", {
        schoolId: args.schoolId,
        assessmentId: args.assessmentId,
        versionId,
        questionId: versionQuestionIds.get(criterion.questionId),
        sourceCriterionId: criterion._id,
        label: criterion.label,
        description: criterion.description,
        maxScore: criterion.maxScore,
        order: criterion.order,
      });
    }

    const isNewlyPublished = assessment.status !== "published";

    if (assessment.status === "scheduled" && assessment.scheduledJobId) {
      await ctx.scheduler.cancel(assessment.scheduledJobId);
    }

    await ctx.db.patch("schoolAssessments", args.assessmentId, {
      currentVersionId: versionId,
      status: "published",
      scheduledAt: undefined,
      scheduledJobId: undefined,
      publishedAt: isNewlyPublished ? now : assessment.publishedAt,
      publishedBy: isNewlyPublished ? user.appUser._id : assessment.publishedBy,
      updatedBy: user.appUser._id,
      updatedAt: now,
    });

    return versionId;
  },
});
