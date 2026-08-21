import "server-only";

import type { OperationalExceptionProperties } from "@repo/analytics/posthog/exception";
import { isServerExceptionReportingEnabled } from "@repo/analytics/server-reporting";
import { Effect, Schema } from "effect";
import { after } from "next/server";

/** Expected failure while sending a handled server exception to analytics. */
class ServerExceptionCaptureError extends Schema.TaggedError<ServerExceptionCaptureError>()(
  "ServerExceptionCaptureError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure while registering request completion work with Next.js. */
class ServerExceptionScheduleError extends Schema.TaggedError<ServerExceptionScheduleError>()(
  "ServerExceptionScheduleError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Captures one server exception without leaking analytics failures. */
const captureServerExceptionSafely = Effect.fn(
  "www.analytics.captureServerExceptionSafely"
)(function* (error: unknown, properties: OperationalExceptionProperties) {
  yield* Effect.tryPromise({
    try: async () => {
      const { captureServerException } = await import(
        "@repo/analytics/posthog/server"
      );
      await captureServerException(error, properties);
    },
    catch: (cause) =>
      new ServerExceptionCaptureError({
        cause,
        message: "Failed to capture server exception.",
      }),
  }).pipe(Effect.ignore);
});

/**
 * Schedules handled request-time error reporting after the response completes.
 *
 * https://nextjs.org/docs/app/api-reference/functions/after#with-request-apis
 */
export const scheduleCurrentServerExceptionCapture = Effect.fn(
  "www.analytics.scheduleCurrentServerExceptionCapture"
)(function* (error: unknown, properties: OperationalExceptionProperties) {
  if (!isServerExceptionReportingEnabled()) {
    return;
  }

  yield* scheduleServerExceptionCapture(error, properties);
});

/** Schedules one handled operational exception without request identity. */
export const scheduleServerExceptionCapture = Effect.fn(
  "www.analytics.scheduleServerExceptionCapture"
)(function* (error: unknown, properties: OperationalExceptionProperties) {
  if (!isServerExceptionReportingEnabled()) {
    return;
  }

  const services = yield* Effect.context<never>();
  const runPromise = Effect.runPromiseWith(services);
  yield* Effect.try({
    catch: (cause) =>
      new ServerExceptionScheduleError({
        cause,
        message: "Failed to schedule server exception reporting.",
      }),
    try: () =>
      after(() => runPromise(captureServerExceptionSafely(error, properties))),
  }).pipe(Effect.ignore);
});
