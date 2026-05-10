import type { LogContext } from "@repo/utilities/logging/types";
import { Duration, Effect, Metric } from "effect";

const SERVER_ERROR_CODE = 500;
const CLIENT_ERROR_CODE = 400;
const operationDuration = Metric.timer(
  "operation_duration",
  "Duration of Effect operations recorded by shared logging utilities."
);

/**
 * Logs an Error through Effect with stable structured metadata.
 */
export const logError = Effect.fn("logging.logError")(function* (
  error: Error,
  context: LogContext = {}
) {
  yield* Effect.logError(error.message).pipe(
    Effect.annotateLogs({
      type: "error",
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    })
  );
});

/**
 * Logs one HTTP request with an Effect log level derived from the status code.
 */
export const logHttpRequest = Effect.fn("logging.logHttpRequest")(function* (
  request: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
  },
  context: LogContext = {}
) {
  const { method, url, statusCode, duration } = request;
  const message = `${method} ${url} - ${statusCode} (${duration}ms)`;
  const payload = {
    type: "http_request",
    method,
    url,
    statusCode,
    duration: `${duration}ms`,
    ...context,
  };

  if (statusCode >= SERVER_ERROR_CODE) {
    yield* Effect.logError(message).pipe(Effect.annotateLogs(payload));
    return;
  }

  if (statusCode >= CLIENT_ERROR_CODE) {
    yield* Effect.logWarning(message).pipe(Effect.annotateLogs(payload));
    return;
  }

  yield* Effect.logInfo(message).pipe(Effect.annotateLogs(payload));
});

/**
 * Adds a trace span, duration metric, and completion log around an Effect.
 */
export const timeOperation = Effect.fn("logging.timeOperation")(
  <A, E, R>(
    label: string,
    operation: Effect.Effect<A, E, R>,
    context: LogContext = {}
  ) =>
    operation.pipe(
      Effect.withSpan(label, {
        attributes: {
          operation: label,
          ...context,
        },
      }),
      Metric.trackDuration(operationDuration),
      Effect.timed,
      Effect.flatMap(([duration, result]) =>
        Effect.logInfo(`${label} completed`).pipe(
          Effect.annotateLogs({
            type: "timer",
            label,
            duration: `${Duration.toMillis(duration)}ms`,
            ...context,
          }),
          Effect.as(result)
        )
      )
    )
);
