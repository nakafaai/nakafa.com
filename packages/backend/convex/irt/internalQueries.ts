import { internalQuery } from "@repo/backend/convex/_generated/server";
import { irtCalibratedItemValidator } from "@repo/backend/convex/irt/validators";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";

export const calibrationQuestionValidator = v.object({
  questionId: vv.id("exerciseQuestions"),
  number: v.number(),
});

export const calibrationResponseValidator = v.object({
  attemptId: vv.id("exerciseAttempts"),
  isCorrect: v.boolean(),
  questionId: vv.id("exerciseQuestions"),
});

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
      "setId",
      args.setId
    );

    return {
      questions: [...questions]
        .sort((a, b) => a.number - b.number)
        .map((question) => ({
          questionId: question._id,
          number: question.number,
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
      throw new Error("Exercise set not found for calibration responses.");
    }

    const attemptPage = await ctx.db
      .query("exerciseAttempts")
      .withIndex("slug_scope_mode_status_startedAt", (q) =>
        q
          .eq("slug", set.slug)
          .eq("scope", "set")
          .eq("mode", "simulation")
          .eq("status", "completed")
      )
      .paginate(args.paginationOpts);

    const answersByAttempt = await Promise.all(
      attemptPage.page.map((attempt) =>
        getManyFrom(
          ctx.db,
          "exerciseAnswers",
          "attemptId_exerciseNumber",
          attempt._id,
          "attemptId"
        )
      )
    );

    const page = answersByAttempt.flatMap((answers, index) => {
      const attempt = attemptPage.page[index];

      if (!attempt) {
        return [];
      }

      return answers.flatMap((answer) => {
        if (answer.questionId === undefined) {
          return [];
        }

        return [
          {
            attemptId: attempt._id,
            isCorrect: answer.isCorrect,
            questionId: answer.questionId,
          },
        ];
      });
    });

    return {
      page,
      isDone: attemptPage.isDone,
      continueCursor: attemptPage.continueCursor,
    };
  },
});
