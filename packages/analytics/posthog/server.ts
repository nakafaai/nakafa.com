import "server-only";

import { keys } from "@repo/analytics/keys";
import {
  createOperationalException,
  decodeOperationalExceptionProperties,
  type OperationalExceptionProperties,
  operationalExceptionGrouping,
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
 * Capture one operational exception grouped by its call site.
 *
 * The `source` becomes the `distinctId`, so repeated failures from one server
 * code path count as one identity instead of a fresh random UUID per event that
 * inflates the affected-user count. The client keeps `personProfiles: "never"`,
 * so no person profile is created. A per-source fingerprint and issue name split
 * unrelated call sites into separate, triageable issues.
 *
 * Docs:
 * https://posthog.com/docs/error-tracking/capture
 * https://posthog.com/docs/error-tracking/fingerprints
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
  const properties = decodedProperties.value;

  const analytics = yield* Effect.try({
    try: getServerAnalytics,
    catch: captureError,
  });
  yield* Effect.tryPromise({
    try: () =>
      analytics.captureExceptionImmediate(
        createOperationalException(error),
        properties.source,
        { ...properties, ...operationalExceptionGrouping(properties) }
      ),
    catch: captureError,
  });
});
