import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  estimateDifficultyFromCorrectRate,
  estimateThetaEap,
  getProvisionalParams,
} from "@repo/backend/confect/modules/tryout/irt.estimation";
import {
  IRT_CALIBRATION_CONVERGENCE_DELTA,
  IRT_CALIBRATION_MAX_ITERATIONS,
  IRT_ESTIMATION_THETA_MAX,
  IRT_ESTIMATION_THETA_MIN,
  IRT_MIN_DISCRIMINATION,
  IRT_MIN_RESPONSES_FOR_CALIBRATED,
  IRT_PROBABILITY_EPSILON,
} from "@repo/backend/confect/modules/tryout/irt.policy";

interface CalibrationQuestion {
  readonly questionId: Id<"exerciseQuestions">;
}

interface CalibrationResponse {
  readonly attemptId: Id<"exerciseAttempts">;
  readonly isCorrect: boolean;
  readonly questionId: Id<"exerciseQuestions">;
}

interface ItemParams {
  readonly difficulty: number;
  readonly discrimination: number;
}

const LOGISTIC_MAX_ITERATIONS = 25;
const LOGISTIC_CONVERGENCE_DELTA = 1e-4;
const HESSIAN_EPSILON = 1e-6;

/** Keeps a numeric value within the supplied inclusive bounds. */
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Converts a probability to log-odds. */
function logit(probability: number) {
  return Math.log(probability / (1 - probability));
}

/** Returns the logistic sigmoid. */
function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

/** Creates item seed parameters from existing values or observed correct rate. */
function createSeedParams(
  correctRate: number,
  existing: ItemParams | undefined
) {
  if (existing) {
    return existing;
  }

  return {
    ...getProvisionalParams(),
    difficulty: estimateDifficultyFromCorrectRate(correctRate),
  };
}

/** Estimates the initial theta from raw correct and total counts. */
function estimateInitialTheta(correctCount: number, totalCount: number) {
  if (totalCount <= 0) {
    return 0;
  }

  const seededProbability = clamp(
    (correctCount + IRT_PROBABILITY_EPSILON) /
      (totalCount + IRT_PROBABILITY_EPSILON * 2),
    IRT_PROBABILITY_EPSILON,
    1 - IRT_PROBABILITY_EPSILON
  );

  return clamp(
    logit(seededProbability),
    IRT_ESTIMATION_THETA_MIN,
    IRT_ESTIMATION_THETA_MAX
  );
}

/** Solves a symmetric two-by-two linear system for logistic Newton steps. */
function solveTwoByTwo(args: {
  readonly a00: number;
  readonly a01: number;
  readonly a11: number;
  readonly b0: number;
  readonly b1: number;
}) {
  const determinant = args.a00 * args.a11 - args.a01 * args.a01;

  if (Math.abs(determinant) < HESSIAN_EPSILON) {
    return null;
  }

  return {
    beta0: (args.a11 * args.b0 - args.a01 * args.b1) / determinant,
    beta1: (-args.a01 * args.b0 + args.a00 * args.b1) / determinant,
  };
}

/** Fits one item's 2PL logistic parameters from theta observations. */
function fitItemLogistic2Pl(
  observations: readonly {
    readonly correct: boolean;
    readonly theta: number;
  }[],
  seed: ItemParams
) {
  let intercept = -(seed.discrimination * seed.difficulty);
  let slope = Math.max(seed.discrimination, IRT_MIN_DISCRIMINATION);
  let converged = false;

  for (let iteration = 0; iteration < LOGISTIC_MAX_ITERATIONS; iteration += 1) {
    let gradient0 = 0;
    let gradient1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;

    for (const observation of observations) {
      const eta = intercept + slope * observation.theta;
      const probability = clamp(
        sigmoid(eta),
        IRT_PROBABILITY_EPSILON,
        1 - IRT_PROBABILITY_EPSILON
      );
      const outcome = observation.correct ? 1 : 0;
      const residual = outcome - probability;
      const weight = probability * (1 - probability);

      gradient0 += residual;
      gradient1 += residual * observation.theta;
      h00 += weight;
      h01 += weight * observation.theta;
      h11 += weight * observation.theta * observation.theta;
    }

    const step = solveTwoByTwo({
      a00: h00,
      a01: h01,
      a11: h11,
      b0: gradient0,
      b1: gradient1,
    });

    if (!step) {
      break;
    }

    intercept += step.beta0;
    slope += step.beta1;

    const maxStep = Math.max(Math.abs(step.beta0), Math.abs(step.beta1));
    if (maxStep < LOGISTIC_CONVERGENCE_DELTA) {
      converged = true;
      break;
    }
  }

  if (!(Number.isFinite(intercept) && Number.isFinite(slope))) {
    return { converged: false, params: seed };
  }

  if (slope <= IRT_MIN_DISCRIMINATION) {
    return { converged: false, params: seed };
  }

  return {
    converged,
    params: {
      difficulty: -intercept / slope,
      discrimination: slope,
    },
  };
}

/** Calibrates 2PL item parameters from cached attempt responses. */
export function calibrateTwoPlItems(args: {
  readonly existingParams: Map<Id<"exerciseQuestions">, ItemParams>;
  readonly questions: readonly CalibrationQuestion[];
  readonly responseCount: number;
  readonly responsesByAttempt: Map<
    Id<"exerciseAttempts">,
    CalibrationResponse[]
  >;
  readonly responsesByQuestion: Map<
    Id<"exerciseQuestions">,
    CalibrationResponse[]
  >;
}) {
  const questionIds = args.questions.map((question) => question.questionId);

  for (const questionId of questionIds) {
    if (args.responsesByQuestion.has(questionId)) {
      continue;
    }

    args.responsesByQuestion.set(questionId, []);
  }

  let itemParams = new Map(
    questionIds.map((questionId) => {
      const questionResponses = args.responsesByQuestion.get(questionId) ?? [];
      const correctCount = questionResponses.reduce(
        (count, response) => count + (response.isCorrect ? 1 : 0),
        0
      );
      const correctRate =
        questionResponses.length > 0
          ? correctCount / questionResponses.length
          : 0.5;

      return [
        questionId,
        createSeedParams(correctRate, args.existingParams.get(questionId)),
      ] as const;
    })
  );

  let thetaByAttempt = new Map(
    [...args.responsesByAttempt.entries()].map(([attemptId, responses]) => {
      const correctCount = responses.reduce(
        (count, response) => count + (response.isCorrect ? 1 : 0),
        0
      );

      return [
        attemptId,
        estimateInitialTheta(correctCount, responses.length),
      ] as const;
    })
  );

  let maxParameterDelta = Number.POSITIVE_INFINITY;
  let iterationCount = 0;

  while (iterationCount < IRT_CALIBRATION_MAX_ITERATIONS) {
    iterationCount += 1;
    const nextParams = new Map(itemParams);
    maxParameterDelta = 0;

    for (const questionId of questionIds) {
      const questionResponses = args.responsesByQuestion.get(questionId) ?? [];

      if (questionResponses.length === 0) {
        continue;
      }

      const observations = questionResponses.flatMap((response) => {
        const theta = thetaByAttempt.get(response.attemptId);

        if (theta === undefined) {
          return [];
        }

        return [{ correct: response.isCorrect, theta }];
      });
      const previousParams =
        itemParams.get(questionId) ?? getProvisionalParams();
      const fitted = fitItemLogistic2Pl(observations, previousParams);
      nextParams.set(questionId, fitted.params);
      maxParameterDelta = Math.max(
        maxParameterDelta,
        Math.abs(fitted.params.difficulty - previousParams.difficulty),
        Math.abs(fitted.params.discrimination - previousParams.discrimination)
      );
    }

    itemParams = nextParams;
    thetaByAttempt = new Map(
      [...args.responsesByAttempt.entries()].map(([attemptId, responses]) => {
        const irtResponses = responses.flatMap((response) => {
          const params = itemParams.get(response.questionId);

          if (!params) {
            return [];
          }

          return [{ correct: response.isCorrect, params }];
        });

        return [attemptId, estimateThetaEap(irtResponses).theta] as const;
      })
    );

    if (maxParameterDelta <= IRT_CALIBRATION_CONVERGENCE_DELTA) {
      break;
    }
  }

  const items = questionIds.map((questionId) => {
    const questionResponses = args.responsesByQuestion.get(questionId) ?? [];
    const itemResponseCount = questionResponses.length;
    const correctCount = questionResponses.reduce(
      (count, response) => count + (response.isCorrect ? 1 : 0),
      0
    );
    const correctRate =
      itemResponseCount > 0 ? correctCount / itemResponseCount : 0;
    const params = itemParams.get(questionId) ?? getProvisionalParams();
    const hasVariation = correctRate > 0 && correctRate < 1;
    const isCalibrated =
      itemResponseCount >= IRT_MIN_RESPONSES_FOR_CALIBRATED &&
      hasVariation &&
      maxParameterDelta <= IRT_CALIBRATION_CONVERGENCE_DELTA;
    let calibrationStatus = "emerging";

    if (itemResponseCount === 0) {
      calibrationStatus = "provisional";
    } else if (isCalibrated) {
      calibrationStatus = "calibrated";
    }

    return {
      calibrationStatus,
      correctRate,
      difficulty: params.difficulty,
      discrimination: params.discrimination,
      questionId,
      responseCount: itemResponseCount,
    };
  });

  return {
    attemptCount: args.responsesByAttempt.size,
    items,
    iterationCount,
    maxParameterDelta: Number.isFinite(maxParameterDelta)
      ? maxParameterDelta
      : 0,
    questionCount: questionIds.length,
    responseCount: args.responseCount,
  };
}
