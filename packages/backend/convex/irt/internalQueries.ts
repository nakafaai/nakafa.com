import { internalQuery } from "@repo/backend/convex/_generated/server";
import { irtCalibratedItemValidator } from "@repo/backend/convex/irt/validators";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";

export const calibrationQuestionValidator = v.object({
  questionId: vv.id("exerciseQuestions"),
});

export const calibrationResponseValidator = v.object({
  attemptId: vv.id("exerciseAttempts"),
  isCorrect: v.boolean(),
  questionId: vv.id("exerciseQuestions"),
});
export type CalibrationResponse = Infer<typeof calibrationResponseValidator>;

export const calibrationQuestionsForSetResultValidator = v.object({
  existingParams: v.array(irtCalibratedItemValidator),
  questions: v.array(calibrationQuestionValidator),
});

export const calibrationResponsesPageResultValidator =
  paginationResultValidator(calibrationResponseValidator);

/**
 * Load the questions in one exercise set together with any previously stored
 * item parameters used as seeds for the next calibration run.
 */
export const getCalibrationQuestionsForSet = internalQuery({
  args: {
    setId: vv.id("exerciseSets"),
  },
  returns: calibrationQuestionsForSetResultValidator,
  handler: async (ctx, args) => {
    const set = await ctx.db.get("exerciseSets", args.setId);

    if (!set) {
      throw new ConvexError({
        code: "IRT_SET_NOT_FOUND",
        message: "Exercise set not found for calibration question lookup.",
      });
    }

    const [questions, existingParams] = await Promise.all([
      ctx.db
        .query("exerciseQuestions")
        .withIndex("setId", (q) => q.eq("setId", args.setId))
        .take(set.questionCount + 1),
      ctx.db
        .query("exerciseItemParameters")
        .withIndex("by_setId", (q) => q.eq("setId", args.setId))
        .take(set.questionCount + 1),
    ]);

    if (questions.length > set.questionCount) {
      throw new ConvexError({
        code: "IRT_QUESTION_COUNT_EXCEEDED",
        message: "Exercise question count exceeds the set question count.",
      });
    }

    if (existingParams.length > set.questionCount) {
      throw new ConvexError({
        code: "IRT_ITEM_PARAMETER_COUNT_EXCEEDED",
        message:
          "Exercise item parameter count exceeds the set question count.",
      });
    }

    return {
      questions: [...questions]
        .sort((a, b) => a.number - b.number)
        .map((question) => ({
          questionId: question._id,
        })),
      existingParams: existingParams.map((params) => ({
        questionId: params.questionId,
        difficulty: params.difficulty,
        discrimination: params.discrimination,
        responseCount: params.responseCount,
        correctRate: params.correctRate,
        calibrationStatus: params.calibrationStatus,
      })),
    };
  },
});

/**
 * Load one page of scored responses from completed simulation set attempts.
 */
export const getCalibrationResponsesPageForSet = internalQuery({
  args: {
    setId: vv.id("exerciseSets"),
    paginationOpts: paginationOptsValidator,
  },
  returns: calibrationResponsesPageResultValidator,
  handler: async (ctx, args) => {
    const set = await ctx.db.get("exerciseSets", args.setId);

    if (!set) {
      throw new ConvexError({
        code: "IRT_SET_NOT_FOUND",
        message: "Exercise set not found for calibration response lookup.",
      });
    }

    const responsePage = await ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId_and_attemptId", (q) => q.eq("setId", args.setId))
      .paginate(args.paginationOpts);

    for (const attempt of responsePage.page) {
      if (attempt.responses.length <= set.questionCount) {
        continue;
      }

      throw new ConvexError({
        code: "IRT_CALIBRATION_RESPONSE_COUNT_EXCEEDED",
        message:
          "Cached calibration response count exceeds the set question count.",
      });
    }

    return {
      page: responsePage.page.flatMap((attempt) =>
        attempt.responses.map((response) => ({
          attemptId: attempt.attemptId,
          isCorrect: response.isCorrect,
          questionId: response.questionId,
        }))
      ),
      isDone: responsePage.isDone,
      continueCursor: responsePage.continueCursor,
    };
  },
});
