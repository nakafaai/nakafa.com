import "server-only";

import { extractDistinctIdFromPostHogCookie } from "@repo/analytics/posthog/attribution";
import { isServerExceptionReportingEnabled } from "@repo/analytics/server-reporting";
import { Effect, Option, Schema } from "effect";
import { cookies } from "next/headers";
import { after } from "next/server";

type ServerExceptionProperties = Record<string | number, unknown>;

/** Expected failure while reading the current request cookie header. */
class RequestCookieHeaderReadError extends Schema.TaggedError<RequestCookieHeaderReadError>()(
  "RequestCookieHeaderReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

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

/** Reads the current request cookies for analytics attribution. */
const getCurrentCookieHeader = Effect.fn(
  "www.analytics.getCurrentCookieHeader"
)(function* () {
  return yield* Effect.tryPromise({
    try: () => cookies().then((requestCookies) => requestCookies.toString()),
    catch: (cause) =>
      new RequestCookieHeaderReadError({
        cause,
        message: "Failed to read request cookies.",
      }),
  });
});

/** Captures one server exception without leaking analytics failures. */
const captureServerExceptionSafely = Effect.fn(
  "www.analytics.captureServerExceptionSafely"
)(function* (
  error: unknown,
  distinctId?: string,
  properties?: ServerExceptionProperties
) {
  yield* Effect.tryPromise({
    try: async () => {
      const { captureServerException } = await import(
        "@repo/analytics/posthog/server"
      );
      await captureServerException(error, distinctId, properties);
    },
    catch: (cause) =>
      new ServerExceptionCaptureError({
        cause,
        message: "Failed to capture server exception.",
      }),
  }).pipe(Effect.ignore);
});

/**
 * Reads request cookies before scheduling handled request-time error reporting.
 *
 * The cookie read proves that this capability runs within a real request. Next
 * forbids request APIs inside an `after` callback, so attribution is resolved
 * before the callback is registered.
 *
 * https://nextjs.org/docs/app/api-reference/functions/after#with-request-apis
 */
export const scheduleCurrentServerExceptionCapture = Effect.fn(
  "www.analytics.scheduleCurrentServerExceptionCapture"
)(function* (error: unknown, properties?: ServerExceptionProperties) {
  if (!isServerExceptionReportingEnabled()) {
    return;
  }

  const cookieHeader = yield* getCurrentCookieHeader().pipe(
    Effect.map(Option.some),
    Effect.catchTag("RequestCookieHeaderReadError", () =>
      Effect.succeed(Option.none<string>())
    )
  );
  if (Option.isNone(cookieHeader)) {
    return;
  }

  yield* scheduleServerExceptionCapture(error, cookieHeader.value, properties);
});

/** Schedules one handled exception when its request cookie is already known. */
export const scheduleServerExceptionCapture = Effect.fn(
  "www.analytics.scheduleServerExceptionCapture"
)(function* (
  error: unknown,
  cookieHeader: string,
  properties?: ServerExceptionProperties
) {
  if (!isServerExceptionReportingEnabled()) {
    return;
  }

  const distinctId = extractDistinctIdFromPostHogCookie(cookieHeader);
  const services = yield* Effect.context<never>();
  const runPromise = Effect.runPromiseWith(services);
  yield* Effect.try({
    catch: (cause) =>
      new ServerExceptionScheduleError({
        cause,
        message: "Failed to schedule server exception reporting.",
      }),
    try: () =>
      after(() =>
        runPromise(captureServerExceptionSafely(error, distinctId, properties))
      ),
  }).pipe(Effect.ignore);
});
