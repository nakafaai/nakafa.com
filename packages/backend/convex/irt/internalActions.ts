import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { calibrateTwoPLItems } from "@repo/backend/convex/irt/calibration";
import type {
  calibrationQuestionsForSetResultValidator,
  calibrationResponsesPageResultValidator,
} from "@repo/backend/convex/irt/internalQueries";
import {
  IRT_OPERATIONAL_MODEL,
  IRT_PROBABILITY_EPSILON,
} from "@repo/backend/convex/irt/policy";
import { irtCalibrationResultValidator } from "@repo/backend/convex/irt/validators";
import { type Infer, v } from "convex/values";

const CALIBRATION_PAGE_SIZE = 500;
type CalibrationQuestionsForSetResult = Infer<
  typeof calibrationQuestionsForSetResultValidator
>;
type CalibrationResponsesPage = Infer<
  typeof calibrationResponsesPageResultValidator
>;
type CalibrationResponse = CalibrationResponsesPage["page"][number];
type ExistingCalibrationParams =
  CalibrationQuestionsForSetResult["existingParams"][number];

/**
 * Run one set-level 2PL calibration job from completed simulation responses.
 *
 * This action intentionally loads responses in pages through internal queries so
 * large calibration jobs do not depend on a single database transaction.
 */
export const calibrateSetTwoPL = internalAction({
  args: {
    setId: v.id("exerciseSets"),
  },
  returns: irtCalibrationResultValidator,
  handler: async (ctx, args) => {
    const { questions, existingParams }: CalibrationQuestionsForSetResult =
      await ctx.runQuery(
        internal.irt.internalQueries.getCalibrationQuestionsForSet,
        { setId: args.setId }
      );

    const responses: CalibrationResponse[] = [];

    for (const question of questions) {
      let cursor: string | null = null;

      while (true) {
        const responsePage: CalibrationResponsesPage = await ctx.runQuery(
          internal.irt.internalQueries.getCalibrationResponsesPageForQuestion,
          {
            questionId: question.questionId,
            paginationOpts: {
              numItems: CALIBRATION_PAGE_SIZE,
              cursor,
            },
          }
        );

        responses.push(...responsePage.page);

        if (responsePage.isDone) {
          break;
        }

        cursor = responsePage.continueCursor;
      }
    }

    const calibration = calibrateTwoPLItems({
      questions,
      responses,
      existingParams: new Map(
        existingParams.map((params: ExistingCalibrationParams) => [
          params.questionId,
          {
            difficulty: params.difficulty,
            discrimination: params.discrimination,
            guessing: params.guessing,
          },
        ])
      ),
    });

    return {
      model: IRT_OPERATIONAL_MODEL,
      attemptCount: calibration.attemptCount,
      responseCount: calibration.responseCount,
      questionCount: calibration.questionCount,
      iterationCount: calibration.iterationCount,
      maxParameterDelta:
        Math.round(calibration.maxParameterDelta / IRT_PROBABILITY_EPSILON) *
        IRT_PROBABILITY_EPSILON,
      items: calibration.items,
    };
  },
});
