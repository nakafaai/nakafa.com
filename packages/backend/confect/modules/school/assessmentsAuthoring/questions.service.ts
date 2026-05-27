import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import {
  requireAssessment,
  requireRichContentSize,
} from "@repo/backend/confect/modules/school/assessments.shared";
import { requirePermission } from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import { Effect } from "effect";

/** Creates a section within an editable assessment. */
export const createSection = Effect.fn("assessments.createSection")(
  function* (args: {
    readonly assessmentId: Id<"schoolAssessments">;
    readonly description?: Doc<"schoolAssessmentSections">["description"];
    readonly durationMinutes?: number;
    readonly schoolId: Id<"schools">;
    readonly title: string;
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const assessment = yield* requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );

    yield* requirePermission(ctx, PERMISSIONS.ASSESSMENT_UPDATE, {
      classId: assessment.classId,
      schoolId: assessment.schoolId,
      userId: user.appUser._id,
    });

    if (args.description) {
      yield* requireRichContentSize(args.description, "Section description");
    }

    const lastSection = yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessmentSections")
        .withIndex("by_assessmentId_and_order", (query) =>
          query.eq("assessmentId", args.assessmentId)
        )
        .order("desc")
        .first()
    );

    return yield* Effect.promise(() =>
      ctx.db.insert("schoolAssessmentSections", {
        assessmentId: args.assessmentId,
        description: args.description,
        durationMinutes: args.durationMinutes,
        order: (lastSection?.order ?? -1) + 1,
        schoolId: args.schoolId,
        title: args.title,
      })
    );
  }
);

/** Creates a question and all nested choices/rubric criteria. */
export const createQuestion = Effect.fn("assessments.createQuestion")(
  function* (args: {
    readonly assessmentId: Id<"schoolAssessments">;
    readonly bankEntryId?: Id<"schoolAssessmentQuestionBankEntries">;
    readonly choices: readonly {
      readonly content: Doc<"schoolAssessmentChoices">["content"];
      readonly isCorrect: boolean;
      readonly key: string;
    }[];
    readonly explanation?: Doc<"schoolAssessmentQuestions">["explanation"];
    readonly maxSelectionCount?: number;
    readonly points: number;
    readonly questionType: Doc<"schoolAssessmentQuestions">["questionType"];
    readonly required: boolean;
    readonly rubricCriteria: readonly {
      readonly description?: Doc<"schoolAssessmentRubricCriteria">["description"];
      readonly label: string;
      readonly maxScore: number;
    }[];
    readonly schoolId: Id<"schools">;
    readonly sectionId: Id<"schoolAssessmentSections">;
    readonly shuffleChoices: boolean;
    readonly source: Doc<"schoolAssessmentQuestions">["source"];
    readonly stem: Doc<"schoolAssessmentQuestions">["stem"];
  }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const assessment = yield* requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );

    yield* requirePermission(ctx, PERMISSIONS.ASSESSMENT_UPDATE, {
      classId: assessment.classId,
      schoolId: assessment.schoolId,
      userId: user.appUser._id,
    });

    const section = yield* Effect.promise(() => ctx.db.get(args.sectionId));

    if (
      !section ||
      section.assessmentId !== assessment._id ||
      section.schoolId !== assessment.schoolId
    ) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "SECTION_NOT_FOUND",
          message: "Section not found for this assessment.",
        })
      );
    }

    yield* requireRichContentSize(args.stem, "Question stem");

    if (args.explanation) {
      yield* requireRichContentSize(args.explanation, "Question explanation");
    }

    if (args.questionType === "essay" && args.choices.length > 0) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "INVALID_QUESTION_SHAPE",
          message: "Essay questions cannot include multiple-choice options.",
        })
      );
    }

    if (args.questionType !== "essay" && args.rubricCriteria.length > 0) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "INVALID_QUESTION_SHAPE",
          message: "Only essay questions can include rubric criteria.",
        })
      );
    }

    const lastQuestion = yield* Effect.promise(() =>
      ctx.db
        .query("schoolAssessmentQuestions")
        .withIndex("by_assessmentId_and_sectionId_and_order", (query) =>
          query
            .eq("assessmentId", args.assessmentId)
            .eq("sectionId", section._id)
        )
        .order("desc")
        .first()
    );
    const questionId = yield* Effect.promise(() =>
      ctx.db.insert("schoolAssessmentQuestions", {
        assessmentId: args.assessmentId,
        bankEntryId: args.bankEntryId,
        choiceCount: args.choices.length,
        explanation: args.explanation,
        maxSelectionCount: args.maxSelectionCount,
        order: (lastQuestion?.order ?? -1) + 1,
        points: args.points,
        questionType: args.questionType,
        required: args.required,
        rubricCriterionCount: args.rubricCriteria.length,
        schoolId: args.schoolId,
        sectionId: section._id,
        shuffleChoices: args.shuffleChoices,
        source: args.source,
        stem: args.stem,
      })
    );

    for (const [choiceOrder, choice] of args.choices.entries()) {
      yield* requireRichContentSize(choice.content, `Choice ${choice.key}`);
      yield* Effect.promise(() =>
        ctx.db.insert("schoolAssessmentChoices", {
          assessmentId: args.assessmentId,
          content: choice.content,
          isCorrect: choice.isCorrect,
          key: choice.key,
          order: choiceOrder,
          questionId,
          schoolId: args.schoolId,
        })
      );
    }

    for (const [criterionOrder, criterion] of args.rubricCriteria.entries()) {
      if (criterion.description) {
        yield* requireRichContentSize(
          criterion.description,
          `Rubric criterion ${criterion.label}`
        );
      }

      yield* Effect.promise(() =>
        ctx.db.insert("schoolAssessmentRubricCriteria", {
          assessmentId: args.assessmentId,
          description: criterion.description,
          label: criterion.label,
          maxScore: criterion.maxScore,
          order: criterionOrder,
          questionId,
          schoolId: args.schoolId,
        })
      );
    }

    return questionId;
  }
);
