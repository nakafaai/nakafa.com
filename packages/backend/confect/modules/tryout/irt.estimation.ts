import {
  IRT_ESTIMATION_THETA_MAX,
  IRT_ESTIMATION_THETA_MIN,
  IRT_ESTIMATION_THETA_POINTS,
} from "@repo/backend/confect/modules/tryout/irt.policy";

interface IrtResponse {
  readonly correct: boolean;
  readonly params: {
    readonly difficulty: number;
    readonly discrimination: number;
  };
}

const THETA_GRID = createThetaGrid();

/** Builds the fixed theta grid used by EAP estimation. */
function createThetaGrid() {
  const step =
    (IRT_ESTIMATION_THETA_MAX - IRT_ESTIMATION_THETA_MIN) /
    (IRT_ESTIMATION_THETA_POINTS - 1);

  return Array.from(
    { length: IRT_ESTIMATION_THETA_POINTS },
    (_, index) => IRT_ESTIMATION_THETA_MIN + index * step
  );
}

/** Calculates the two-parameter logistic probability of a correct response. */
function probabilityCorrect(
  theta: number,
  discrimination: number,
  difficulty: number
) {
  return 1 / (1 + Math.exp(-discrimination * (theta - difficulty)));
}

/** Computes the likelihood for a theta value across scored item responses. */
function likelihood(theta: number, responses: readonly IrtResponse[]) {
  let product = 1;

  for (const response of responses) {
    const probability = probabilityCorrect(
      theta,
      response.params.discrimination,
      response.params.difficulty
    );
    product *= response.correct ? probability : 1 - probability;
  }

  return product;
}

/** Computes a normal density for the theta prior. */
function normalPdf(value: number, mean: number, standardDeviation: number) {
  const exponent = -0.5 * ((value - mean) / standardDeviation) ** 2;
  return (
    (1 / (standardDeviation * Math.sqrt(2 * Math.PI))) * Math.exp(exponent)
  );
}

/** Estimates theta with expected a posteriori scoring. */
export function estimateThetaEap(
  responses: readonly IrtResponse[],
  priorMean = 0,
  priorStandardDeviation = 1
) {
  if (responses.length === 0) {
    return { theta: priorMean, se: priorStandardDeviation };
  }

  let totalWeight = 0;
  const weights = THETA_GRID.map((theta) => {
    const prior = normalPdf(theta, priorMean, priorStandardDeviation);
    const responseLikelihood = likelihood(theta, responses);
    const weight = prior * responseLikelihood;
    totalWeight += weight;
    return weight;
  });

  if (totalWeight === 0 || !Number.isFinite(totalWeight)) {
    return { theta: priorMean, se: priorStandardDeviation };
  }

  const normalizedWeights = weights.map((weight) => weight / totalWeight);
  let theta = 0;

  for (const [index, gridTheta] of THETA_GRID.entries()) {
    theta += gridTheta * normalizedWeights[index];
  }

  let variance = 0;
  for (const [index, gridTheta] of THETA_GRID.entries()) {
    variance += normalizedWeights[index] * (gridTheta - theta) ** 2;
  }

  const se = Math.sqrt(variance);
  return {
    theta: Number.isFinite(theta) ? theta : priorMean,
    se: Number.isFinite(se) ? se : priorStandardDeviation,
  };
}

/** Returns stable provisional 2PL item parameters. */
export function getProvisionalParams() {
  return {
    difficulty: 0,
    discrimination: 1,
  };
}

/** Seeds item difficulty from observed correct rate. */
export function estimateDifficultyFromCorrectRate(correctRate: number) {
  const boundedCorrectRate = Math.max(0.01, Math.min(0.99, correctRate));
  return Math.log((1 - boundedCorrectRate) / boundedCorrectRate);
}
