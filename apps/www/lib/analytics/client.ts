"use client";

import { captureException } from "@repo/analytics/posthog";
import { Effect } from "effect";

type ClientExceptionProperties = Record<string | number, unknown>;

/** Reports one handled client-side exception through the app analytics module. */
export const reportClientException = Effect.fn(
  "www.analytics.reportClientException"
)(function* (error: unknown, properties?: ClientExceptionProperties) {
  yield* Effect.sync(() => {
    captureException(error, properties);
  });
});
