/**
 * Operational IRT model used for current tryout scoring.
 */
export const IRT_OPERATIONAL_MODEL = "2pl";

/**
 * Shared bounded theta support used by operational EAP scoring and any public
 * report-score transforms built on top of it.
 */
export const IRT_OPERATIONAL_THETA_MIN = -4;
export const IRT_OPERATIONAL_THETA_MAX = 4;

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

/** Maximum number of queue rows deleted in one cleanup mutation. */
export const IRT_QUEUE_CLEANUP_BATCH_SIZE = 100;

/** Maximum number of completed attempts backfilled in one calibration sync pass. */
export const IRT_CALIBRATION_RESPONSE_BACKFILL_BATCH_SIZE = 25;

/** Maximum number of cached calibration attempts trimmed in one mutation. */
export const IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE = 100;

/** Maximum number of cached calibration attempts counted in one rebuild page. */
export const IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE = 500;

/** Maximum number of completed attempts loaded into one calibration action. */
export const IRT_MAX_CALIBRATION_ATTEMPTS_PER_RUN = 10_000;

/** Maximum number of scored responses loaded into one calibration action. */
export const IRT_MAX_CALIBRATION_RESPONSES_PER_RUN = 250_000;

/** Number of trailing days retained in the operational live calibration window. */
export const IRT_LIVE_WINDOW_DAYS = 365;

/** Minimum per-set cache attempts required before an official scale can publish. */
export const IRT_MIN_ATTEMPTS_FOR_OFFICIAL_SCALE =
  IRT_MIN_RESPONSES_FOR_CALIBRATED;

/**
 * Returns the largest calibration-attempt cache we can keep for one set without
 * letting the calibration action grow beyond its operational response budget.
 */
export function getCalibrationAttemptCacheLimit(questionCount: number) {
  const boundedQuestionCount = Math.max(questionCount, 1);
  const responseBound = Math.floor(
    IRT_MAX_CALIBRATION_RESPONSES_PER_RUN / boundedQuestionCount
  );

  return Math.max(
    1,
    Math.min(IRT_MAX_CALIBRATION_ATTEMPTS_PER_RUN, responseBound)
  );
}

/** Returns the earliest timestamp still included in the live calibration window. */
export function getCalibrationWindowStartAt(now: number) {
  return now - IRT_LIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Interval, in minutes, for the automatic IRT automation crons. */
export const IRT_AUTOMATION_CRON_INTERVAL_MINUTES = 15;
