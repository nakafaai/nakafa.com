const DAYS_PER_LIVE_WINDOW = 365;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1e3;

export const IRT_OPERATIONAL_MODEL = "2pl";
export const IRT_ESTIMATION_THETA_MIN = -6;
export const IRT_ESTIMATION_THETA_MAX = 6;
export const IRT_ESTIMATION_THETA_POINTS = 61;
export const IRT_MIN_RESPONSES_FOR_CALIBRATED = 200;
export const IRT_CALIBRATION_MAX_ITERATIONS = 15;
export const IRT_CALIBRATION_CONVERGENCE_DELTA = 0.01;
export const IRT_PROBABILITY_EPSILON = 1e-3;
export const IRT_MIN_DISCRIMINATION = 0.05;
export const IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION = 50;
export const IRT_MAX_CALIBRATION_STALENESS_MS =
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND;
export const IRT_CALIBRATION_QUEUE_BATCH_SIZE = 5;
export const IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE = 10;
export const IRT_SCALE_QUALITY_REFRESH_QUEUE_BATCH_SIZE = 25;
export const IRT_SCALE_QUALITY_REFRESH_CLAIM_TIMEOUT_MS =
  15 * MINUTES_PER_HOUR * MILLISECONDS_PER_SECOND;
export const IRT_QUEUE_CLEANUP_BATCH_SIZE = 100;
export const IRT_CALIBRATION_RESPONSE_BACKFILL_BATCH_SIZE = 25;
export const IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE = 100;
export const IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE = 500;
export const IRT_MAX_CALIBRATION_ATTEMPTS_PER_RUN = 1e4;
export const IRT_MAX_CALIBRATION_RESPONSES_PER_RUN = 25e4;
export const IRT_MIN_ATTEMPTS_FOR_OFFICIAL_SCALE =
  IRT_MIN_RESPONSES_FOR_CALIBRATED;
export const IRT_AUTOMATION_CRON_INTERVAL_MINUTES = 15;

/** Returns the maximum cached attempts that one set can keep for calibration. */
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

/** Computes the start of the rolling live calibration window. */
export function getCalibrationWindowStartAt(now: number) {
  return (
    now -
    DAYS_PER_LIVE_WINDOW *
      HOURS_PER_DAY *
      MINUTES_PER_HOUR *
      SECONDS_PER_MINUTE *
      MILLISECONDS_PER_SECOND
  );
}
