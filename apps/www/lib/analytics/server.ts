import "@tanstack/react-start/server-only";

import type { OperationalExceptionProperties } from "@repo/analytics/posthog/exception";
import { isServerExceptionReportingEnabled } from "@repo/analytics/server-reporting";
import { getRequestHeader } from "@tanstack/react-start/server";
import { waitUntil } from "@vercel/functions";
import { Effect, Schema } from "effect";

/** The request has no user agent to read, because no request scope is active. */
class RequestUserAgentUnavailable extends Schema.TaggedError<RequestUserAgentUnavailable>()(
  "RequestUserAgentUnavailable",
  { cause: Schema.Unknown }
) {}

/** Expected failure while registering request completion work with the platform. */
class ServerExceptionScheduleError extends Schema.TaggedError<ServerExceptionScheduleError>()(
  "ServerExceptionScheduleError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/**
 * Reads the current request user agent so PostHog classifies the fault's
 * traffic type instead of filing every server capture under automation.
 *
 * The read is best-effort: outside a request scope `getRequestHeader` throws,
 * and the capture then proceeds without the classification hint.
 */
const readRequestUserAgent = Effect.fn("www.analytics.readRequestUserAgent")(
  function* () {
    return yield* Effect.try({
      catch: (cause) => new RequestUserAgentUnavailable({ cause }),
      try: () => getRequestHeader("user-agent"),
    }).pipe(Effect.orElseSucceed(() => undefined));
  }
);

/**
 * Captures one server exception without leaking analytics failures into the
 * caller.
 *
 * This is the module's public best-effort seam: reporting runs behind a
 * dynamic import and swallows its own failures, so a missing analytics runtime
 * or a rejected PostHog call never fails the operation that produced the
 * error. It reads the current request user agent so every caller separates
 * visitor faults from crawlers and automation at triage. Callers that must
 * observe the capture failure use `captureServerException` directly.
 */
export const captureServerExceptionSafely = Effect.fn(
  "www.analytics.captureServerExceptionSafely"
)(function* (error: unknown, properties: OperationalExceptionProperties) {
  const requestUserAgent = yield* readRequestUserAgent();
  yield* Effect.tryPromise(() => import("@repo/analytics/posthog/server")).pipe(
    Effect.flatMap((reporting) =>
      reporting.captureServerException(error, properties, requestUserAgent)
    ),
    Effect.ignore
  );
});

/**
 * Schedules handled request-time error reporting after the response completes.
 * The platform keeps the function alive until the capture settles.
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
      waitUntil(
        captureServerExceptionSafely(error, properties).pipe(runPromise)
      ),
  }).pipe(Effect.ignore);
});
