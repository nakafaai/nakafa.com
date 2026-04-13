import type { Properties } from "posthog-js";
import posthog from "posthog-js";

export { default as analytics } from "posthog-js";

/**
 * Capture a PostHog `$exception` event with optional extra context.
 *
 * Mirrors the PostHog Web SDK `captureException` API so callers can report
 * handled client-side errors without reaching into `posthog-js` directly.
 *
 * Docs:
 * https://posthog.com/docs/error-tracking/capture
 * https://posthog.com/docs/error-tracking/installation/nextjs
 */
export function captureException(
  error: unknown,
  additionalProperties?: Properties
) {
  return posthog.captureException(error, additionalProperties);
}
