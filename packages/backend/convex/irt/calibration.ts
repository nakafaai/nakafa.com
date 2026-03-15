import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  estimateDifficultyFromCorrectRate,
  estimateThetaEAP,
  getProvisionalParams,
} from "@repo/backend/convex/irt/estimation";
import {
  IRT_CALIBRATION_CONVERGENCE_DELTA,
  IRT_CALIBRATION_MAX_ITERATIONS,
  IRT_MIN_DISCRIMINATION,
  IRT_MIN_RESPONSES_FOR_CALIBRATED,
  IRT_PROBABILITY_EPSILON,
} from "@repo/backend/convex/irt/policy";

interface CalibrationResponse {
  attemptId: Id<"exerciseAttempts">;
  isCorrect: boolean;
  questionId: Id<"exerciseQuestions">;
}

interface CalibrationSeed {
  difficulty: number;
  discrimination: number;
}

const THETA_SEED_MIN = -4;
const THETA_SEED_MAX = 4;
const LOGISTIC_MAX_ITERATIONS = 25;
const LOGISTIC_CONVERGENCE_DELTA = 1e-4;
const HESSIAN_EPSILON = 1e-6;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function logit(probability: number) {
  return Math.log(probability / (1 - probability));
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function createSeedParams(correctRate: number, existing?: CalibrationSeed) {
  if (existing) {
    return existing;
  }

  const provisional = getProvisionalParams();

  return {
    ...provisional,
    difficulty: estimateDifficultyFromCorrectRate(correctRate),
  };
}

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

  return clamp(logit(seededProbability), THETA_SEED_MIN, THETA_SEED_MAX);
}

function solveTwoByTwo({
  a00,
  a01,
  a11,
  b0,
  b1,
}: {
  a00: number;
  a01: number;
  a11: number;
  b0: number;
  b1: number;
}) {
  const determinant = a00 * a11 - a01 * a01;

  if (Math.abs(determinant) < HESSIAN_EPSILON) {
    return null;
  }

  return {
    beta0: (a11 * b0 - a01 * b1) / determinant,
    beta1: (-a01 * b0 + a00 * b1) / determinant,
  };
}

function fitItemLogistic2PL(
  observations: Array<{ correct: boolean; theta: number }>,
  seed: CalibrationSeed
) {
  let intercept = -(seed.discrimination * seed.difficulty);
  let slope = Math.max(seed.discrimination, IRT_MIN_DISCRIMINATION);
  let converged = false;

  for (let iteration = 0; iteration < LOGISTIC_MAX_ITERATIONS; iteration++) {
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
    return {
      converged: false,
      params: seed,
    };
  }

  if (slope <= IRT_MIN_DISCRIMINATION) {
    return {
      converged: false,
      params: seed,
    };
  }

  return {
    converged,
    params: {
      difficulty: -intercept / slope,
      discrimination: slope,
    },
  };
}

/**
 * Run alternating 2PL calibration for one set of dichotomous items.
 *
 * The pipeline seeds item difficulty from the observed correct rate, estimates
 * person theta with EAP, then refits each item with logistic regression on the
 * current theta estimates until the item parameters stabilize.
 */
export function calibrateTwoPLItems({
  questions,
  responses,
  existingParams,
}: {
  questions: Array<{ questionId: Id<"exerciseQuestions"> }>;
  responses: CalibrationResponse[];
  existingParams: Map<Id<"exerciseQuestions">, CalibrationSeed>;
}) {
  const questionIds = questions.map((question) => question.questionId);
  const responsesByQuestion = new Map<
    Id<"exerciseQuestions">,
    CalibrationResponse[]
  >();
  for (const questionId of questionIds) {
    responsesByQuestion.set(questionId, []);
  }
  const responsesByAttempt = new Map<
    Id<"exerciseAttempts">,
    CalibrationResponse[]
  >();

  for (const response of responses) {
    responsesByQuestion.get(response.questionId)?.push(response);

    const attemptResponses = responsesByAttempt.get(response.attemptId) ?? [];
    attemptResponses.push(response);
    responsesByAttempt.set(response.attemptId, attemptResponses);
  }

  let itemParams = new Map(
    questionIds.map((questionId) => {
      const questionResponses = responsesByQuestion.get(questionId) ?? [];
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
        createSeedParams(correctRate, existingParams.get(questionId)),
      ];
    })
  );

  let thetaByAttempt = new Map(
    [...responsesByAttempt.entries()].map(([attemptId, attemptResponses]) => {
      const correctCount = attemptResponses.reduce(
        (count, response) => count + (response.isCorrect ? 1 : 0),
        0
      );

      return [
        attemptId,
        estimateInitialTheta(correctCount, attemptResponses.length),
      ];
    })
  );

  let maxParameterDelta = Number.POSITIVE_INFINITY;
  let iterationCount = 0;

  while (iterationCount < IRT_CALIBRATION_MAX_ITERATIONS) {
    iterationCount += 1;
    const nextParams = new Map(itemParams);
    maxParameterDelta = 0;

    for (const questionId of questionIds) {
      const questionResponses = responsesByQuestion.get(questionId) ?? [];

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
      const fitted = fitItemLogistic2PL(observations, previousParams);

      nextParams.set(questionId, fitted.params);

      maxParameterDelta = Math.max(
        maxParameterDelta,
        Math.abs(fitted.params.difficulty - previousParams.difficulty),
        Math.abs(fitted.params.discrimination - previousParams.discrimination)
      );
    }

    itemParams = nextParams;

    thetaByAttempt = new Map(
      [...responsesByAttempt.entries()].map(([attemptId, attemptResponses]) => {
        const irtResponses = attemptResponses.flatMap((response) => {
          const params = itemParams.get(response.questionId);

          if (!params) {
            return [];
          }

          return [{ correct: response.isCorrect, params }];
        });

        return [attemptId, estimateThetaEAP(irtResponses).theta];
      })
    );

    if (maxParameterDelta <= IRT_CALIBRATION_CONVERGENCE_DELTA) {
      break;
    }
  }

  const items = questionIds.map((questionId) => {
    const questionResponses = responsesByQuestion.get(questionId) ?? [];
    const responseCount = questionResponses.length;
    const correctCount = questionResponses.reduce(
      (count, response) => count + (response.isCorrect ? 1 : 0),
      0
    );
    const correctRate = responseCount > 0 ? correctCount / responseCount : 0;
    const params = itemParams.get(questionId) ?? getProvisionalParams();
    const hasVariation = correctRate > 0 && correctRate < 1;
    const isCalibrated =
      responseCount >= IRT_MIN_RESPONSES_FOR_CALIBRATED &&
      hasVariation &&
      maxParameterDelta <= IRT_CALIBRATION_CONVERGENCE_DELTA;

    let calibrationStatus: "provisional" | "emerging" | "calibrated" =
      "emerging";

    if (responseCount === 0) {
      calibrationStatus = "provisional";
    } else if (isCalibrated) {
      calibrationStatus = "calibrated";
    }

    return {
      questionId,
      difficulty: params.difficulty,
      discrimination: params.discrimination,
      responseCount,
      correctRate,
      calibrationStatus,
    };
  });

  return {
    attemptCount: responsesByAttempt.size,
    responseCount: responses.length,
    questionCount: questionIds.length,
    iterationCount,
    maxParameterDelta: Number.isFinite(maxParameterDelta)
      ? maxParameterDelta
      : 0,
    items,
  };
}
