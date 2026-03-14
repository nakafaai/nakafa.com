/**
 * Operational IRT model used for current SNBT scoring.
 *
 * We intentionally keep the operational model conservative and interpretable by
 * using 2PL for scoring while still storing a guessing parameter for future
 * calibration work.
 */
export const IRT_OPERATIONAL_MODEL = "2pl" as const;

/**
 * Conservative minimum scored responses required before an item is promoted to
 * `calibrated` automatically.
 *
 * This is an operational quality-control floor, not a universal psychometric
 * theorem. Items below this threshold remain `emerging` even if optimization
 * converges, so official scoring policy can stay cautious.
 */
export const IRT_MIN_RESPONSES_FOR_CALIBRATED = 200;

/** Maximum number of alternating 2PL calibration iterations. */
export const IRT_CALIBRATION_MAX_ITERATIONS = 15;

/** Convergence threshold for the maximum absolute item-parameter delta. */
export const IRT_CALIBRATION_CONVERGENCE_DELTA = 0.01;

/** Numerical floor for seeded response rates and logistic probabilities. */
export const IRT_PROBABILITY_EPSILON = 0.001;

/** Minimum positive discrimination retained from automated 2PL fitting. */
export const IRT_MIN_DISCRIMINATION = 0.05;
