/**
 * Operational IRT model used for current SNBT scoring.
 */
export const IRT_OPERATIONAL_MODEL = "2pl";

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

/**
 * Minimum number of newly completed simulation set attempts before a queued set
 * is recalibrated immediately.
 */
export const IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION = 50;

/**
 * Backstop for low-volume sets so queued calibration work is not postponed
 * indefinitely.
 */
export const IRT_MAX_CALIBRATION_STALENESS_MS = 24 * 60 * 60 * 1000;

/** Maximum number of distinct sets to start calibrating in one queue drain. */
export const IRT_CALIBRATION_QUEUE_BATCH_SIZE = 5;

/** Maximum number of distinct tryouts to publish in one queue drain. */
export const IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE = 10;

/** Interval, in minutes, for the automatic IRT automation crons. */
export const IRT_AUTOMATION_CRON_INTERVAL_MINUTES = 15;
