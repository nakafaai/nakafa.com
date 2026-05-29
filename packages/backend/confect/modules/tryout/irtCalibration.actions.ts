import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { calibrateTwoPlItems } from "@repo/backend/confect/modules/tryout/irt.calibration";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import {
  IRT_MAX_CALIBRATION_ATTEMPTS_PER_RUN,
  IRT_MAX_CALIBRATION_RESPONSES_PER_RUN,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import { Effect } from "effect";

const CALIBRATION_RESPONSE_PAGE_SIZE = 100;

/** Runs the CPU-bound two-parameter logistic calibration for one exercise set. */
export const calibrateSetTwoPL = Effect.fnUntraced(function* (args: {
  readonly setId: Id<"exerciseSets">;
}) {
  const runQuery = yield* QueryRunner;
  const { existingParams, questions } = yield* runQuery(
    refs.internal.irt.queries.internalFunctions.calibration
      .getCalibrationQuestionsForSet,
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
    Id<"exerciseAttempts">,
    {
      attemptId: Id<"exerciseAttempts">;
      isCorrect: boolean;
      questionId: Id<"exerciseQuestions">;
    }[]
  >();
  const responsesByQuestion = new Map<
    Id<"exerciseQuestions">,
    {
      attemptId: Id<"exerciseAttempts">;
      isCorrect: boolean;
      questionId: Id<"exerciseQuestions">;
    }[]
  >(questionIds.map((questionId) => [questionId, []]));
  let responseCount = 0;
  let responsePage = yield* runQuery(
    refs.internal.irt.queries.internalFunctions.calibration
      .getCalibrationResponsesPageForSet,
    {
      paginationOpts: {
        cursor: null,
        numItems: attemptPageSize,
      },
      setId: args.setId,
    }
  );

  while (true) {
    for (const response of responsePage.page) {
      const questionResponses = responsesByQuestion.get(response.questionId);

      if (!questionResponses) {
        return yield* Effect.fail(
          new IrtError({
            code: "IRT_RESPONSE_QUESTION_NOT_IN_SET",
            message:
              "Calibration response references a question outside the set.",
          })
        );
      }

      questionResponses.push(response);

      const attemptResponses = responsesByAttempt.get(response.attemptId) ?? [];
      attemptResponses.push(response);

      if (attemptResponses.length > questionIds.length) {
        return yield* Effect.fail(
          new IrtError({
            code: "IRT_ATTEMPT_RESPONSE_COUNT_EXCEEDED",
            message:
              "One calibration attempt has more responses than the set question count.",
          })
        );
      }

      responsesByAttempt.set(response.attemptId, attemptResponses);
      responseCount += 1;

      if (responseCount > IRT_MAX_CALIBRATION_RESPONSES_PER_RUN) {
        return yield* Effect.fail(
          new IrtError({
            code: "IRT_CALIBRATION_RESPONSE_LIMIT_EXCEEDED",
            message:
              "Calibration response volume exceeds the supported action limit.",
          })
        );
      }
    }

    if (responsesByAttempt.size > IRT_MAX_CALIBRATION_ATTEMPTS_PER_RUN) {
      return yield* Effect.fail(
        new IrtError({
          code: "IRT_CALIBRATION_ATTEMPT_LIMIT_EXCEEDED",
          message:
            "Calibration attempt volume exceeds the supported action limit.",
        })
      );
    }

    if (responsePage.isDone) {
      break;
    }

    responsePage = yield* runQuery(
      refs.internal.irt.queries.internalFunctions.calibration
        .getCalibrationResponsesPageForSet,
      {
        paginationOpts: {
          cursor: responsePage.continueCursor,
          numItems: attemptPageSize,
        },
        setId: args.setId,
      }
    );
  }

  const existingParamsByQuestionId = new Map(
    existingParams.map((params) => [
      params.questionId,
      {
        difficulty: params.difficulty,
        discrimination: params.discrimination,
      },
    ])
  );
  const calibration = calibrateTwoPlItems({
    existingParams: existingParamsByQuestionId,
    questions,
    responseCount,
    responsesByAttempt,
    responsesByQuestion,
  });

  return {
    attemptCount: calibration.attemptCount,
    items: calibration.items,
    iterationCount: calibration.iterationCount,
    maxParameterDelta: calibration.maxParameterDelta,
    model: "2pl" as const,
    questionCount: calibration.questionCount,
    responseCount: calibration.responseCount,
  };
});
