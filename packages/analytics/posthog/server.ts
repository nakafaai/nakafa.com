import "server-only";

import { keys } from "@repo/analytics/keys";
import {
  createOperationalException,
  decodeOperationalExceptionProperties,
  type OperationalExceptionProperties,
} from "@repo/analytics/posthog/exception";
import { isServerExceptionReportingEnabled } from "@repo/analytics/server-reporting";
import { Effect, Option, Schema } from "effect";
import { PostHog } from "posthog-node";

let analyticsKeys: ReturnType<typeof keys> | undefined;
let serverAnalytics: PostHog | undefined;

/** Expected failure while initializing or using server exception reporting. */
export class ServerAnalyticsCaptureError extends Schema.TaggedError<ServerAnalyticsCaptureError>()(
  "ServerAnalyticsCaptureError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

function captureError(cause: unknown) {
  return new ServerAnalyticsCaptureError({
    cause,
    message: "Failed to capture the server exception.",
  });
}

/** Lazily validates server analytics configuration after the runtime gate. */
function getAnalyticsKeys() {
  analyticsKeys ??= keys();
  return analyticsKeys;
}

/**
 * Creates one serverless PostHog client only after reporting is authorized.
 *
 * Docs:
 * https://posthog.com/docs/libraries/next-js#server-side-analytics
 */
function getServerAnalytics() {
  if (serverAnalytics) {
    return serverAnalytics;
  }

  const runtimeKeys = getAnalyticsKeys();
  serverAnalytics = new PostHog(runtimeKeys.NEXT_PUBLIC_POSTHOG_KEY, {
    disableGeoip: true,
    disableSurveys: true,
    enableExceptionAutocapture: false,
    host: runtimeKeys.POSTHOG_PROXY_HOST,
    flushAt: 1,
    flushInterval: 0,
    personProfiles: "never",
    preloadFeatureFlags: false,
    sendFeatureFlagEvent: false,
  });
  return serverAnalytics;
}

/**
 * Capture one operational exception without a user or analytics identity.
 *
 * The installed PostHog Node client creates a random per-event UUID and sets
 * `$process_person_profile = false` when `distinctId` is omitted. The client is
 * private to this module, so request identity cannot enter through SDK context.
 *
 * Docs:
 * https://posthog.com/docs/error-tracking/capture
 * https://posthog.com/docs/error-tracking/installation/nextjs
 */
export const captureServerException = Effect.fn(
  "Analytics.captureServerException"
)(function* (
  error: unknown,
  additionalProperties: OperationalExceptionProperties
) {
  if (!isServerExceptionReportingEnabled()) {
    return;
  }
  const decodedProperties =
    decodeOperationalExceptionProperties(additionalProperties);
  if (Option.isNone(decodedProperties)) {
    return;
  }

  const analytics = yield* Effect.try({
    try: getServerAnalytics,
    catch: captureError,
  });
  yield* Effect.tryPromise({
    try: () =>
      analytics.captureExceptionImmediate(
        createOperationalException(error),
        undefined,
        decodedProperties.value
      ),
    catch: captureError,
  });
});
