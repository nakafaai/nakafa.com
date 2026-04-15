import {
  requireAssessment,
  requireAssessmentPermission,
} from "@repo/backend/convex/assessments/helpers/access";
import { requireRichContentSize } from "@repo/backend/convex/assessments/helpers/content";
import { richContentValidator } from "@repo/backend/convex/assessments/schema";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { ConvexError, v } from "convex/values";

/** Create one authored question with its structured options or rubric criteria. */
export const createQuestion = mutation({
  args: {
    schoolId: v.id("schools"),
    assessmentId: v.id("schoolAssessments"),
    sectionId: v.id("schoolAssessmentSections"),
    questionType: v.union(
      v.literal("mcq-single"),
      v.literal("mcq-multi"),
      v.literal("essay")
    ),
    source: v.union(
      v.literal("manual"),
      v.literal("bank"),
      v.literal("ai-import")
    ),
    stem: richContentValidator,
    explanation: v.optional(richContentValidator),
    points: v.number(),
    required: v.boolean(),
    shuffleChoices: v.boolean(),
    maxSelectionCount: v.optional(v.number()),
    bankEntryId: v.optional(v.id("schoolAssessmentQuestionBankEntries")),
    choices: v.array(
      v.object({
        key: v.string(),
        content: richContentValidator,
        isCorrect: v.boolean(),
      })
    ),
    rubricCriteria: v.array(
      v.object({
        label: v.string(),
        description: v.optional(richContentValidator),
        maxScore: v.number(),
      })
    ),
  },
  returns: v.id("schoolAssessmentQuestions"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requireAssessmentPermission(
      ctx,
      user.appUser._id,
      args.schoolId,
      "assessment:update"
    );

    await requireAssessment(ctx, args.schoolId, args.assessmentId);

    requireRichContentSize(args.stem, "Question stem");

    if (args.explanation) {
      requireRichContentSize(args.explanation, "Question explanation");
    }

    if (args.questionType === "essay" && args.choices.length > 0) {
      throw new ConvexError({
        code: "INVALID_QUESTION_SHAPE",
        message: "Essay questions cannot include multiple-choice options.",
      });
    }

    if (args.questionType !== "essay" && args.rubricCriteria.length > 0) {
      throw new ConvexError({
        code: "INVALID_QUESTION_SHAPE",
        message: "Only essay questions can include rubric criteria.",
      });
    }

    const questionOrder = await ctx.db
      .query("schoolAssessmentQuestions")
      .withIndex("by_assessmentId_and_sectionId_and_order", (q) =>
        q.eq("assessmentId", args.assessmentId).eq("sectionId", args.sectionId)
      )
      .collect();

    const questionId = await ctx.db.insert("schoolAssessmentQuestions", {
      schoolId: args.schoolId,
      assessmentId: args.assessmentId,
      sectionId: args.sectionId,
      questionType: args.questionType,
      source: args.source,
      stem: args.stem,
      explanation: args.explanation,
      order: questionOrder.length,
      points: args.points,
      required: args.required,
      shuffleChoices: args.shuffleChoices,
      maxSelectionCount: args.maxSelectionCount,
      rubricCriterionCount: args.rubricCriteria.length,
      choiceCount: args.choices.length,
      bankEntryId: args.bankEntryId,
    });

    for (const [choiceOrder, choice] of args.choices.entries()) {
      requireRichContentSize(choice.content, `Choice ${choice.key}`);

      await ctx.db.insert("schoolAssessmentChoices", {
        schoolId: args.schoolId,
        assessmentId: args.assessmentId,
        questionId,
        key: choice.key,
        content: choice.content,
        order: choiceOrder,
        isCorrect: choice.isCorrect,
      });
    }

    for (const [criterionOrder, criterion] of args.rubricCriteria.entries()) {
      if (criterion.description) {
        requireRichContentSize(
          criterion.description,
          `Rubric criterion ${criterion.label}`
        );
      }

      await ctx.db.insert("schoolAssessmentRubricCriteria", {
        schoolId: args.schoolId,
        assessmentId: args.assessmentId,
        questionId,
        label: criterion.label,
        description: criterion.description,
        maxScore: criterion.maxScore,
        order: criterionOrder,
      });
    }

    return questionId;
  },
});
