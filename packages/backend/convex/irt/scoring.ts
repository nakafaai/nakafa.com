/**
 * SNBT score conversion utilities.
 *
 * SNBT uses IRT (Item Response Theory) for scoring. The θ (theta) ability
 * estimate is converted to a 200-1000 score scale for display.
 *
 * Score interpretation:
 * - 200: Lowest possible score
 * - 600: Average ability (θ = 0)
 * - 800: High ability (θ ≈ +2)
 * - 1000: Maximum score
 */

/** SNBT score boundaries */
const SNBT_SCORE_MIN = 200;
const SNBT_SCORE_MAX = 1000;

/** θ = 0 maps to score of 600 (center of scale) */
const SNBT_SCORE_CENTER = 600;

/** Each unit of θ adds/subtracts 100 points */
const SNBT_SCORE_SCALE = 100;

/**
 * Converts IRT θ (theta) to SNBT score (200-1000).
 *
 * @param theta - IRT ability estimate (typically -3 to +3)
 * @returns SNBT score (200-1000)
 */
export function thetaToSnbtScore(theta: number): number {
  const score = SNBT_SCORE_CENTER + theta * SNBT_SCORE_SCALE;
  return Math.round(Math.max(SNBT_SCORE_MIN, Math.min(SNBT_SCORE_MAX, score)));
}

/**
 * Converts SNBT score back to IRT θ (theta).
 *
 * @param score - SNBT score (200-1000)
 * @returns IRT θ (theta)
 */
export function snbtScoreToTheta(score: number): number {
  return (score - SNBT_SCORE_CENTER) / SNBT_SCORE_SCALE;
}

/**
 * Converts θ to percentile rank (0-100).
 *
 * Uses the standard normal CDF to find what proportion of the population
 * would score below this θ.
 *
 * @param theta - IRT ability estimate
 * @returns Percentile rank (0-100)
 */
export function thetaToPercentile(theta: number): number {
  const percentile = 0.5 * (1 + erf(theta / Math.sqrt(2)));
  return Math.round(percentile * 100);
}

/**
 * Converts percentile rank to θ.
 *
 * @param percentile - Percentile rank (1-99)
 * @returns IRT θ (theta)
 */
export function percentileToTheta(percentile: number): number {
  const p = Math.max(0.01, Math.min(0.99, percentile / 100));
  return normalPPF(p);
}

/**
 * Error function (erf) approximation.
 *
 * Used for computing the standard normal CDF.
 * Implemented using Abramowitz and Stegun approximation.
 */
function erf(x: number): number {
  const a1 = 0.254_829_592;
  const a2 = -0.284_496_736;
  const a3 = 1.421_413_741;
  const a4 = -1.453_152_027;
  const a5 = 1.061_405_429;
  const p = 0.327_591_1;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1 / (1 + p * absX);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Normal percent point function (inverse CDF).
 *
 * Returns the z-value such that P(Z ≤ z) = p.
 * Used for converting percentiles back to θ.
 *
 * Implemented using the AS 241 algorithm by Wichura.
 */
function normalPPF(p: number): number {
  if (p <= 0) {
    return Number.NEGATIVE_INFINITY;
  }
  if (p >= 1) {
    return Number.POSITIVE_INFINITY;
  }

  /** Coefficients for rational approximation in the central region */
  const a = [
    -3.969_683_028_665_376e1, 2.209_460_984_245_205e2, -2.759_285_104_469_687e2,
    1.383_577_518_672_69e2, -3.066_479_806_614_716e1, 2.506_628_277_459_239,
  ];
  const b = [
    -5.447_609_779_838_507e1, 1.615_858_368_580_409e2, -1.556_989_798_598_866e2,
    6.680_131_188_771_972e1, -1.328_068_155_288_572e1,
  ];
  /** Coefficients for rational approximation in the tails */
  const c = [
    -7.784_894_200_430_119e-3, -3.223_996_455_485_443e-1,
    -2.400_758_322_027_295, -2.549_732_594_785_254, 4.374_473_385_794_437,
    2.938_163_985_708_025,
  ];
  const d = [
    7.784_695_709_041_462e-3, 3.224_671_438_700_122e-1, 2.445_134_137_896_921,
    3.754_408_663_652_188,
  ];

  /** Breakpoints for choosing the approximation region */
  const pLow = 0.024_25;
  const pHigh = 1 - pLow;

  /** Lower tail */
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    const numerator =
      ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5];
    const denominator = (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1;
    return numerator / denominator;
  }

  /** Central region */
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    const numerator =
      ((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5];
    const denominator =
      ((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1;
    return (numerator * q) / denominator;
  }

  /** Upper tail */
  const q = Math.sqrt(-2 * Math.log(1 - p));
  const numerator =
    ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5];
  const denominator = (((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1;
  return -numerator / denominator;
}

/**
 * Calculates raw score percentage from correct/total counts.
 *
 * @param correct - Number of correct answers
 * @param total - Total number of questions
 * @returns Percentage (0-100, rounded to 2 decimal places)
 */
export function calculateRawScorePercentage(
  correct: number,
  total: number
): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((correct / total) * 10_000) / 100;
}

/**
 * Calculates weighted average θ from multiple subject θ estimates.
 *
 * Uses inverse-variance weighting: subjects with lower SE (more precise)
 * contribute more to the average.
 *
 * @param thetas - Array of {theta, se} objects from each subject
 * @returns Weighted average {theta, se}
 */
export function calculateAverageTheta(
  thetas: Array<{ theta: number; se: number }>
): { theta: number; se: number } {
  if (thetas.length === 0) {
    return { theta: 0, se: 1 };
  }

  let sumTheta = 0;
  let sumWeight = 0;

  for (const t of thetas) {
    /** Weight = 1/variance = 1/se² */
    const weight = 1 / (t.se * t.se);
    sumTheta += t.theta * weight;
    sumWeight += weight;
  }

  if (sumWeight === 0) {
    return { theta: 0, se: 1 };
  }

  const avgTheta = sumTheta / sumWeight;
  /** Standard error of weighted average = sqrt(1/sumWeight) */
  const avgSE = Math.sqrt(1 / sumWeight);

  return {
    theta: Number.isFinite(avgTheta) ? avgTheta : 0,
    se: Number.isFinite(avgSE) ? avgSE : 1,
  };
}
