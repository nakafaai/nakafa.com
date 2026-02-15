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
 * Default maximum content pieces to generate per day (across all locales).
 * Each content piece will be generated for ALL supported locales.
 *
 * Example: MAX_CONTENT_PER_DAY = 1, SUPPORTED_LOCALES = ["en", "id"]
 * Result: 1 content × 2 locales = 2 audio files per day
 *
 * Override via LIMIT_AUDIO_GENERATION_PER_DAY environment variable.
 */
export const DEFAULT_MAX_CONTENT_PER_DAY = 1;

/**
 * Maximum allowed content pieces per day (safety limit to prevent runaway costs).
 */
const MAX_CONTENT_PER_DAY_LIMIT = 10;

/**
 * Get the maximum content pieces to generate per day.
 * Reads from LIMIT_AUDIO_GENERATION_PER_DAY environment variable.
 * Falls back to DEFAULT_MAX_CONTENT_PER_DAY if not set or invalid.
 * Clamped between 1 and MAX_CONTENT_PER_DAY_LIMIT.
 *
 * @returns Validated max content per day (1-10)
 */
export function getMaxContentPerDay(): number {
  const envValue = process.env.LIMIT_AUDIO_GENERATION_PER_DAY;

  if (!envValue) {
    return DEFAULT_MAX_CONTENT_PER_DAY;
  }

  const parsed = Number.parseInt(envValue, 10);

  if (Number.isNaN(parsed)) {
    return DEFAULT_MAX_CONTENT_PER_DAY;
  }

  // Clamp between 1 and MAX_CONTENT_PER_DAY_LIMIT
  return Math.max(1, Math.min(MAX_CONTENT_PER_DAY_LIMIT, parsed));
}

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
 * Queue item timeout configuration.
 * Items stuck in "processing" state for longer than this are considered stale
 * and will be reset to "pending" for reprocessing.
 *
 * Default: 2 hours - accounts for:
 * - Script generation (fast, seconds)
 * - Speech generation (slow, can be minutes for long content)
 * - Network delays and retries
 * - Workflow step overhead
 */
export const QUEUE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Check if audio generation is enabled for this deployment.
 * Set ENABLE_AUDIO_GENERATION=true in Convex Dashboard to enable.
 *
 * @returns true if audio generation should execute (ElevenLabs API calls)
 */
export function isAudioGenerationEnabled(): boolean {
  return process.env.ENABLE_AUDIO_GENERATION === "true";
}

/**
 * Regex for splitting text into words for word count estimation.
 * Used for calculating audio duration from script length.
 */
export const WORD_SPLIT_REGEX = /\s+/;

/**
 * Audio duration calculation constants.
 * Used for estimating audio duration from word count.
 */
export const WORDS_PER_MINUTE = 150; // Average speaking rate
export const SECONDS_PER_MINUTE = 60;
