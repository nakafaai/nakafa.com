const SNBT_SCORE_MIN = 200;
const SNBT_SCORE_MAX = 1000;
const SNBT_SCORE_CENTER = 600;
const SNBT_SCORE_SCALE = 100;

/**
 * Convert IRT theta to the displayed SNBT score scale.
 */
export function thetaToSnbtScore(theta: number) {
  const score = SNBT_SCORE_CENTER + theta * SNBT_SCORE_SCALE;
  return Math.round(Math.max(SNBT_SCORE_MIN, Math.min(SNBT_SCORE_MAX, score)));
}
