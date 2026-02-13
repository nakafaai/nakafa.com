/**
 * Audio generation configuration constants.
 * Centralized configuration for cron jobs and rate limiting.
 */

/** Locales supported for audio generation */
export const SUPPORTED_LOCALES = ["en", "id"] as const;

/** Daily generation limits per locale */
export const DAILY_GENERATION_LIMITS = {
  en: 20,
  id: 30,
} as const;

/** Minimum view threshold for queue eligibility */
export const MIN_VIEW_THRESHOLD = 10;

/** Cron configuration */
export const CRON_CONFIG = {
  // Set to false to disable all audio generation crons (useful for dev)
  enabled: false,

  // Individual cron toggles for granular control
  aggregatePopularity: true, // Every 30 min
  processQueue: true, // Every 5 min
  cleanup: true, // Daily at 2 AM

  // Processing limits
  maxItemsPerProcess: 5,
  batchSize: 100,
} as const;

/** Retry configuration */
export const RETRY_CONFIG = {
  maxRetries: 3,
} as const;

/** Cleanup configuration */
export const CLEANUP_CONFIG = {
  retentionDays: 30,
} as const;
