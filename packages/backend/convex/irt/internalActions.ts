import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { calibrateTwoPLItems } from "@repo/backend/convex/irt/calibration";
import type { calibrationResponseValidator } from "@repo/backend/convex/irt/internalQueries";
import { IRT_PROBABILITY_EPSILON } from "@repo/backend/convex/irt/policy";
import { irtCalibrationResultValidator } from "@repo/backend/convex/irt/validators";
import { type Infer, v } from "convex/values";

const CALIBRATION_PAGE_SIZE = 100;
type CalibrationResponse = Infer<typeof calibrationResponseValidator>;

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
    const { questions, existingParams } = await ctx.runQuery(
      internal.irt.internalQueries.getCalibrationQuestionsForSet,
      {
        setId: args.setId,
      }
    );
    const responses: CalibrationResponse[] = [];
    let continueCursor: string | null = null;
    let isDone = false;
    let page: CalibrationResponse[] = [];

    while (!isDone) {
      ({ continueCursor, isDone, page } = await ctx.runQuery(
        internal.irt.internalQueries.getCalibrationResponsesPageForSet,
        {
          setId: args.setId,
          paginationOpts: {
            numItems: CALIBRATION_PAGE_SIZE,
            cursor: continueCursor,
          },
        }
      ));

      responses.push(...page);
    }

    const calibration = calibrateTwoPLItems({
      questions,
      responses,
      existingParams: new Map(
        existingParams.map((params) => [
          params.questionId,
          {
            difficulty: params.difficulty,
            discrimination: params.discrimination,
          },
        ])
      ),
    });

    const result = {
      model: "2pl",
      attemptCount: calibration.attemptCount,
      responseCount: calibration.responseCount,
      questionCount: calibration.questionCount,
      iterationCount: calibration.iterationCount,
      maxParameterDelta:
        Math.round(calibration.maxParameterDelta / IRT_PROBABILITY_EPSILON) *
        IRT_PROBABILITY_EPSILON,
      items: calibration.items,
    } satisfies Infer<typeof irtCalibrationResultValidator>;

    return result;
  },
});
