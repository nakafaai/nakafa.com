"use client";

import { captureException } from "@repo/analytics/posthog/browser";
import type { OperationalExceptionProperties } from "@repo/analytics/posthog/exception";
import { Effect } from "effect";

/** Reports one handled client-side exception through the app analytics module. */
export const reportClientException = Effect.fn(
  "www.analytics.reportClientException"
)(function* (error: unknown, properties: OperationalExceptionProperties) {
  yield* Effect.sync(() => {
    captureException(error, properties);
  });
});
