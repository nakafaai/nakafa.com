/**
 * Audio generation configuration constants.
 * Centralized configuration for cron jobs and rate limiting.
 *
 * Environment-based behavior:
 * - aggregatePopularity: Always runs (builds statistics for trending)
 * - processQueue: Only executes audio generation if ENABLE_AUDIO_GENERATION env var is set
 * - cleanup: Always runs (maintenance)
 *
 * To enable audio generation in production:
 * Set ENABLE_AUDIO_GENERATION=true in the Convex Dashboard deployment settings
 */

import type { Locale } from "@repo/backend/convex/lib/validators/contents";

/**
 * Locales supported for audio generation.
 * This is the single source of truth for supported locales.
 * When adding new locales, update this array and the content will be
 * automatically generated for all locales.
 */
export const SUPPORTED_LOCALES: Locale[] = ["en", "id"];

/**
 * Maximum content pieces to generate per day (across all locales).
 * Each content piece will be generated for ALL supported locales.
 *
 * Example: MAX_CONTENT_PER_DAY = 1, SUPPORTED_LOCALES = ["en", "id"]
 * Result: 1 content × 2 locales = 2 audio files per day
 */
export const MAX_CONTENT_PER_DAY = 1;

/** Minimum view threshold for queue eligibility */
export const MIN_VIEW_THRESHOLD = 10;

/** Retry configuration */
export const RETRY_CONFIG = {
  maxRetries: 3,
} as const;

/** Cleanup configuration */
export const CLEANUP_CONFIG = {
  retentionDays: 30,
} as const;

/**
 * Check if audio generation is enabled for this deployment.
 * Set ENABLE_AUDIO_GENERATION=true in Convex Dashboard to enable.
 *
 * @returns true if audio generation should execute (ElevenLabs API calls)
 */
export function isAudioGenerationEnabled(): boolean {
  return process.env.ENABLE_AUDIO_GENERATION === "true";
}
