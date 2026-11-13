import { Schema } from "effect";

/**
 * Retries a welcome email through a provider outage: five attempts from thirty
 * seconds, doubling, span about eight minutes before the email is given up.
 */
export const WELCOME_EMAIL_RETRY = {
  base: 2,
  initialBackoffMs: 30_000,
  maxAttempts: 5,
} as const;
export const welcomeIntentFailedCode = "WELCOME_INTENT_FAILED";

/** Expected failure while declaring or activating one welcome intent. */
export class WelcomeIntentError extends Schema.TaggedError<
  WelcomeIntentError,
  { readonly brand: unique symbol }
>()("WelcomeIntentError", {
  code: Schema.Literal(welcomeIntentFailedCode),
  message: Schema.String,
}) {}

/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
