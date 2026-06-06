import "server-only";

import {
  captureServerException,
  extractDistinctIdFromPostHogCookie,
} from "@repo/analytics/posthog/server";
import { Effect, Schema } from "effect";
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
  }).pipe(
    Effect.catchTag("RequestCookieHeaderReadError", () => Effect.succeed(""))
  );
});

/** Captures one handled server exception without leaking analytics failures. */
export const captureCurrentServerException = Effect.fn(
  "www.analytics.captureCurrentServerException"
)(function* (error: unknown, properties?: ServerExceptionProperties) {
  const cookieHeader = yield* getCurrentCookieHeader();
  const distinctId = extractDistinctIdFromPostHogCookie(cookieHeader);

  yield* Effect.tryPromise({
    try: () => captureServerException(error, distinctId, properties),
    catch: (cause) =>
      new ServerExceptionCaptureError({
        cause,
        message: "Failed to capture server exception.",
      }),
  }).pipe(Effect.ignore);
});

/** Schedules handled server exception reporting through Next.js `after`. */
export function scheduleCurrentServerExceptionCapture(
  error: unknown,
  properties?: ServerExceptionProperties
) {
  after(() =>
    Effect.runPromise(captureCurrentServerException(error, properties))
  );
}
