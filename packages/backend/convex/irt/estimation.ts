import {
  IRT_ESTIMATION_THETA_MAX,
  IRT_ESTIMATION_THETA_MIN,
  IRT_ESTIMATION_THETA_POINTS,
} from "@repo/backend/convex/irt/policy";

/**
 * Operational IRT estimation helpers.
 *
 * These routines intentionally favor stable, bounded scoring over mathematically
 * ambitious optimization. The current production scoring path uses a fixed EAP
 * grid on a wider operational interval so extreme response patterns are less
 * likely to clip against the integration boundary during tryout finalization.
 */

export interface ItemParameters {
  difficulty: number;
  discrimination: number;
}

export interface Response {
  correct: boolean;
  params: ItemParameters;
}

const THETA_MIN = IRT_ESTIMATION_THETA_MIN;
const THETA_MAX = IRT_ESTIMATION_THETA_MAX;
const THETA_POINTS = IRT_ESTIMATION_THETA_POINTS;
const THETA_GRID = getThetaGrid();

/** Build the fixed theta grid used by every EAP integration pass. */
function getThetaGrid(): number[] {
  const grid: number[] = [];
  const step = (THETA_MAX - THETA_MIN) / (THETA_POINTS - 1);
  for (let i = 0; i < THETA_POINTS; i++) {
    grid.push(THETA_MIN + i * step);
  }
  return grid;
}

function probabilityCorrect(theta: number, a: number, b: number): number {
  return 1 / (1 + Math.exp(-a * (theta - b)));
}

function likelihood(theta: number, responses: Response[]): number {
  let product = 1;
  for (const response of responses) {
    const p = probabilityCorrect(
      theta,
      response.params.discrimination,
      response.params.difficulty
    );
    product *= response.correct ? p : 1 - p;
  }
  return product;
}

function normalPDF(x: number, mean: number, sd: number): number {
  const exp = -0.5 * ((x - mean) / sd) ** 2;
  return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(exp);
}

/**
 * Estimate ability (`theta`) with a bounded Expected A Posteriori pass.
 *
 * The implementation multiplies a standard-normal prior by the likelihood at
 * each fixed theta grid point, normalizes the weights, then returns the
 * weighted mean and standard deviation. If numerical underflow wipes out the
 * weights, the caller gets the prior back instead of a misleading extreme.
 */
export function estimateThetaEAP(
  responses: Response[],
  priorMean = 0,
  priorSD = 1
): { theta: number; se: number } {
  if (responses.length === 0) {
    return { theta: priorMean, se: priorSD };
  }

  const weights: number[] = [];
  let sumWeights = 0;

  for (const theta of THETA_GRID) {
    const prior = normalPDF(theta, priorMean, priorSD);
    const lik = likelihood(theta, responses);
    const weight = prior * lik;
    weights.push(weight);
    sumWeights += weight;
  }

  if (sumWeights === 0 || !Number.isFinite(sumWeights)) {
    return { theta: priorMean, se: priorSD };
  }

  const normalizedWeights = weights.map((w) => w / sumWeights);

  let theta = 0;
  for (let i = 0; i < THETA_GRID.length; i++) {
    theta += THETA_GRID[i] * normalizedWeights[i];
  }

  let variance = 0;
  for (let i = 0; i < THETA_GRID.length; i++) {
    variance += normalizedWeights[i] * (THETA_GRID[i] - theta) ** 2;
  }
  const se = Math.sqrt(variance);

  return {
    theta: Number.isFinite(theta) ? theta : priorMean,
    se: Number.isFinite(se) ? se : priorSD,
  };
}

/**
 * Return the neutral 2PL parameters used before an item has enough evidence to
 * support calibration.
 */
export function getProvisionalParams(): ItemParameters {
  return {
    difficulty: 0,
    discrimination: 1,
  };
}

/**
 * Seed difficulty from the observed correct rate for uncalibrated items.
 *
 * This is only a bootstrap heuristic. Full calibration later replaces this
 * value with the alternating 2PL estimate.
 */
export function estimateDifficultyFromCorrectRate(correctRate: number): number {
  const cr = Math.max(0.01, Math.min(0.99, correctRate));
  return Math.log((1 - cr) / cr);
}
