import "server-only";

import { keys } from "@repo/analytics/keys";
import { isServerExceptionReportingEnabled } from "@repo/analytics/server-reporting";
import { PostHog } from "posthog-node";

type ServerExceptionProperties = Record<string | number, unknown>;

let analyticsKeys: ReturnType<typeof keys> | undefined;
let serverAnalytics: PostHog | undefined;

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
    host: runtimeKeys.POSTHOG_PROXY_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return serverAnalytics;
}

/**
 * Capture one server-side exception and wait for PostHog to enqueue it.
 *
 * Docs:
 * https://posthog.com/docs/error-tracking/capture
 * https://posthog.com/docs/error-tracking/installation/nextjs
 */
export async function captureServerException(
  error: unknown,
  distinctId?: string,
  additionalProperties?: ServerExceptionProperties
) {
  if (!isServerExceptionReportingEnabled()) {
    return;
  }

  await getServerAnalytics().captureExceptionImmediate(
    error,
    distinctId,
    additionalProperties
  );
}
