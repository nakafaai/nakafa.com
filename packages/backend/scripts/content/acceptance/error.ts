import { Array as Arr, Effect, Schedule, Schema } from "effect";
import stripAnsi from "strip-ansi";

const MAX_COMMAND_ERROR_LENGTH = 2000;
const WHITESPACE = /\s+/u;

export const sanitizeAcceptanceCommandError = (
  text: string,
  sensitiveValues: readonly string[]
) => {
  let sanitized = stripAnsi(text);

  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue.length > 0) {
      sanitized = sanitized.replaceAll(sensitiveValue, "[redacted]");
    }
  }

  return Arr.join(sanitized.trim().split(WHITESPACE), " ").slice(
    -MAX_COMMAND_ERROR_LENGTH
  );
};

/** Expected failure during isolated fixture preparation or local lifecycle control. */
class AcceptanceRuntimeError extends Schema.TaggedError<AcceptanceRuntimeError>()(
  "AcceptanceRuntimeError",
  { message: Schema.String }
) {}

export const acceptanceRuntimeError = (message: string) =>
  new AcceptanceRuntimeError({ message });

const VERSION_SERVICE_SERVER_ERROR = /version\.convex\.dev returned 5\d{2}\b/u;

/**
 * The Convex CLI reports a failed version lookup as `version.convex.dev returned
 * <status>`. A 5xx is an outside failure that a new start can outlast; any other
 * status means the request itself failed, so it stops at once.
 */
export const isVersionServiceServerError = (message: string) =>
  VERSION_SERVICE_SERVER_ERROR.test(message);

/**
 * Makes at most three attempts at a local Convex start, pausing one second and
 * then three, and only while the failure is a version service server error. The
 * start must release everything it acquired when it fails, so a retry begins clean.
 */
export const retryVersionServiceStart = <
  A,
  E extends { readonly message: string },
  R,
>(
  start: Effect.Effect<A, E, R>
) =>
  Effect.retry(start, {
    schedule: Schedule.exponential("1 second", 3),
    times: 2,
    while: (error) => isVersionServiceServerError(error.message),
  });
