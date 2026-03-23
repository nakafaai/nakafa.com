import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { calibrateTwoPLItems } from "@repo/backend/convex/irt/calibration";
import type { CalibrationResponse } from "@repo/backend/convex/irt/internalQueries";
import {
  IRT_MAX_CALIBRATION_ATTEMPTS_PER_RUN,
  IRT_MAX_CALIBRATION_RESPONSES_PER_RUN,
} from "@repo/backend/convex/irt/policy";
import { irtCalibrationResultValidator } from "@repo/backend/convex/irt/validators";
import { ConvexError, type Infer, v } from "convex/values";

const CALIBRATION_PAGE_SIZE = 100;

/**
 * Run one set-level 2PL calibration job from completed simulation responses.
 *
 * This action intentionally loads responses in pages through internal queries so
 * large calibration jobs do not depend on a single database transaction.
 * It also enforces explicit operational bounds so one calibration run stays
 * predictable in action memory and runtime.
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
    const questionIds = questions.map((question) => question.questionId);
    const responsesByAttempt = new Map<
      CalibrationResponse["attemptId"],
      CalibrationResponse[]
    >();
    const responsesByQuestion = new Map<
      CalibrationResponse["questionId"],
      CalibrationResponse[]
    >();

    for (const questionId of questionIds) {
      responsesByQuestion.set(questionId, []);
    }

    let continueCursor: string | null = null;
    let isDone = false;
    let page: CalibrationResponse[] = [];
    let responseCount = 0;

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

      for (const response of page) {
        const questionResponses = responsesByQuestion.get(response.questionId);

        if (questionResponses) {
          questionResponses.push(response);
        }

        const attemptResponses =
          responsesByAttempt.get(response.attemptId) ?? [];
        attemptResponses.push(response);
        responsesByAttempt.set(response.attemptId, attemptResponses);
        responseCount += 1;

        if (responseCount > IRT_MAX_CALIBRATION_RESPONSES_PER_RUN) {
          throw new ConvexError({
            code: "IRT_CALIBRATION_RESPONSE_LIMIT_EXCEEDED",
            message:
              "Calibration response volume exceeds the supported action limit.",
          });
        }
      }

      if (responsesByAttempt.size > IRT_MAX_CALIBRATION_ATTEMPTS_PER_RUN) {
        throw new ConvexError({
          code: "IRT_CALIBRATION_ATTEMPT_LIMIT_EXCEEDED",
          message:
            "Calibration attempt volume exceeds the supported action limit.",
        });
      }
    }

    const calibration = calibrateTwoPLItems({
      responseCount,
      questions,
      responsesByAttempt,
      responsesByQuestion,
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
      maxParameterDelta: calibration.maxParameterDelta,
      items: calibration.items,
    } satisfies Infer<typeof irtCalibrationResultValidator>;

    return result;
  },
});
