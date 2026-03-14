/**
 * IRT (Item Response Theory) estimation algorithms.
 *
 * Uses EAP (Expected A Posteriori) for ability estimation.
 * Compatible with SNBT scoring methodology.
 */

export interface ItemParameters {
  difficulty: number;
  discrimination: number;
  guessing: number;
}

export interface Response {
  correct: boolean;
  params: ItemParameters;
}

const THETA_MIN = -4;
const THETA_MAX = 4;
const THETA_POINTS = 41;
const THETA_GRID = getThetaGrid();

function getThetaGrid(): number[] {
  const grid: number[] = [];
  const step = (THETA_MAX - THETA_MIN) / (THETA_POINTS - 1);
  for (let i = 0; i < THETA_POINTS; i++) {
    grid.push(THETA_MIN + i * step);
  }
  return grid;
}

function probabilityCorrect(
  theta: number,
  a: number,
  b: number,
  c: number
): number {
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

function likelihood(theta: number, responses: Response[]): number {
  let product = 1;
  for (const response of responses) {
    const p = probabilityCorrect(
      theta,
      response.params.discrimination,
      response.params.difficulty,
      response.params.guessing
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
 * Convert stored item parameters to the operational 2PL policy used for SNBT
 * scoring.
 *
 * The backend still persists `guessing` for future calibration work, but the
 * current operational model sets `c = 0` so scoring behaves as a 2PL model.
 */
export function toOperationalTwoPLParams(
  params: ItemParameters
): ItemParameters {
  return {
    difficulty: params.difficulty,
    discrimination: params.discrimination,
    guessing: 0,
  };
}

/**
 * Estimates ability (θ) using EAP (Expected A Posteriori).
 *
 * @param responses - Array of responses with item parameters
 * @param priorMean - Prior mean for θ (default: 0)
 * @param priorSD - Prior standard deviation for θ (default: 1)
 * @returns Estimated θ and standard error
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
 * Returns provisional IRT parameters for new questions.
 * Used before sufficient responses are collected for calibration.
 */
export function getProvisionalParams(): ItemParameters {
  return {
    difficulty: 0,
    discrimination: 1,
    guessing: 0,
  };
}

/**
 * Estimates difficulty from correct rate (provisional method).
 * Used when item parameters haven't been calibrated yet.
 *
 * @param correctRate - Proportion of correct responses (0-1)
 * @returns Estimated difficulty parameter
 */
export function estimateDifficultyFromCorrectRate(correctRate: number): number {
  const cr = Math.max(0.01, Math.min(0.99, correctRate));
  return -Math.log((1 - cr) / cr);
}
