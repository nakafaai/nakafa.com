import { internalQuery } from "@repo/backend/convex/_generated/server";
import { irtCalibratedItemValidator } from "@repo/backend/convex/irt/validators";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";

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
    const questions = await getManyFrom(
      ctx.db,
      "exerciseQuestions",
      "setId",
      args.setId
    );
    const existingParams = await getManyFrom(
      ctx.db,
      "exerciseItemParameters",
      "by_setId",
      args.setId,
      "setId"
    );

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
    const responsePage = await ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId_and_attemptId", (q) => q.eq("setId", args.setId))
      .paginate(args.paginationOpts);

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
