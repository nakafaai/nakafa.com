import { internal } from "@repo/backend/convex/_generated/api";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { calibrateTwoPLItems } from "@repo/backend/convex/irt/calibration";
import {
  IRT_MAX_CALIBRATION_ATTEMPTS_PER_RUN,
  IRT_MAX_CALIBRATION_RESPONSES_PER_RUN,
} from "@repo/backend/convex/irt/policy";
import type { CalibrationResponse } from "@repo/backend/convex/irt/queries/internal/calibration";
import { irtCalibrationResultValidator } from "@repo/backend/convex/irt/validators";
import { ConvexError, type Infer, v } from "convex/values";

const CALIBRATION_RESPONSE_PAGE_SIZE = 100;

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
      internal.irt.queries.internal.calibration.getCalibrationQuestionsForSet,
      {
        setId: args.setId,
      }
    );
    const questionIds = questions.map((question) => question.questionId);
    const responsesPerAttemptLimit = Math.max(questionIds.length, 1);
    const attemptPageSize = Math.max(
      1,
      Math.floor(CALIBRATION_RESPONSE_PAGE_SIZE / responsesPerAttemptLimit)
    );
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
        internal.irt.queries.internal.calibration
          .getCalibrationResponsesPageForSet,
        {
          setId: args.setId,
          paginationOpts: {
            numItems: attemptPageSize,
            cursor: continueCursor,
          },
        }
      ));

      for (const response of page) {
        const questionResponses = responsesByQuestion.get(response.questionId);

        if (!questionResponses) {
          throw new ConvexError({
            code: "IRT_RESPONSE_QUESTION_NOT_IN_SET",
            message:
              "Calibration response references a question outside the set.",
          });
        }

        questionResponses.push(response);

        const attemptResponses =
          responsesByAttempt.get(response.attemptId) ?? [];
        attemptResponses.push(response);

        if (attemptResponses.length > questionIds.length) {
          throw new ConvexError({
            code: "IRT_ATTEMPT_RESPONSE_COUNT_EXCEEDED",
            message:
              "One calibration attempt has more responses than the set question count.",
          });
        }

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

    return {
      model: "2pl",
      attemptCount: calibration.attemptCount,
      responseCount: calibration.responseCount,
      questionCount: calibration.questionCount,
      iterationCount: calibration.iterationCount,
      maxParameterDelta: calibration.maxParameterDelta,
      items: calibration.items,
    } satisfies Infer<typeof irtCalibrationResultValidator>;
  },
});
