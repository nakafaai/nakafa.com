/** Retries an idempotent PostHog erasure before durable workflow recovery. */
export const ANALYTICS_ERASURE_RETRY = {
  base: 2,
  initialBackoffMs: 1000,
  maxAttempts: 10,
};

/** Rechecks deleted accounts after external requests have drained. */
export const LATE_ANALYTICS_RECONCILIATION_DELAY_MS = 24 * 60 * 60 * 1000;
