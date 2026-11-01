/** Below this many forecasts a month says too little to take the forecast away. */
const MIN_FORECASTS = 200;

/** A student reached the KKTP when their share of a competency's points in a sitting meets it. */
export const reachedKktp = (earned: number, possible: number, kktp: number) =>
  earned / possible >= kktp / 100;

/** The squared error of one forecast against what happened, the term of the Brier score. */
export const squaredError = (chance: number, reached: boolean) =>
  (chance - (reached ? 1 : 0)) ** 2;

/**
 * One month's verdict on the forecast. Its Brier score must beat the score of always answering the month's base
 * rate, the plain forecast that knows nothing of a student, and a smaller score is better (ADR 0035).
 */
export const verdictOf = (totals: {
  readonly count: number;
  readonly errors: number;
  readonly reached: number;
}) => {
  const rate = totals.reached / totals.count;
  const baseline = rate * (1 - rate);
  const brier = totals.errors / totals.count;
  return {
    baseline,
    brier,
    count: totals.count,
    passed: totals.count < MIN_FORECASTS || brier < baseline,
  };
};
