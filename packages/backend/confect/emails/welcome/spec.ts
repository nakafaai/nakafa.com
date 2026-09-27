import {
  ACCOUNT_DELETION_RECOVERY_DELAY_MS,
  ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES,
} from "@repo/backend/confect/auth/deletion/constants";
import { Schema } from "effect";
export const WELCOME_EMAIL_FROM = "Nakafa <nakafa@notifications.nakafa.com>";
const retryBase = 2;
const retryInitialBackoffMs = 30_000;
/**
 * Workpool 0.4.10 jitters each backoff by `0.5 + Math.random()`.
 * @see https://github.com/get-convex/workpool/blob/v0.4.10/src/component/loop.ts#L702-L704
 */
const retryMinimumJitterFactor = 0.5;
const deletionRecoveryWindowMs =
  ACCOUNT_DELETION_RECOVERY_DELAY_MS +
  ACCOUNT_DELETION_RECOVERY_SWEEP_INTERVAL_MINUTES * 60 * 1000;
function attemptsCoveringDeletionRecovery() {
  let attempts = 1;
  let coveredMs = 0;
  let nextBackoffMs = retryInitialBackoffMs;
  while (coveredMs < deletionRecoveryWindowMs) {
    coveredMs += nextBackoffMs * retryMinimumJitterFactor;
    nextBackoffMs *= retryBase;
    attempts += 1;
  }
  return attempts;
}

/** Retries until reversible account deletion has passed one recovery sweep. */
export const WELCOME_EMAIL_RETRY = {
  base: retryBase,
  initialBackoffMs: retryInitialBackoffMs,
  maxAttempts: attemptsCoveringDeletionRecovery(),
} as const;
export const welcomeIntentFailedCode = "WELCOME_INTENT_FAILED";
export const welcomeIntentDeferredCode = "WELCOME_INTENT_DEFERRED";

/** Expected failure while declaring or activating one welcome intent. */
export class WelcomeIntentError extends Schema.TaggedError<WelcomeIntentError>()(
  "WelcomeIntentError",
  {
    code: Schema.Literal(welcomeIntentFailedCode),
    message: Schema.String,
  }
) {}

/** Retryable pause while reversible account deletion is active. */

export class WelcomeIntentDeferredError extends Schema.TaggedError<WelcomeIntentDeferredError>()(
  "WelcomeIntentDeferredError",
  {
    code: Schema.Literal(welcomeIntentDeferredCode),
    message: Schema.String,
  }
) {}
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
