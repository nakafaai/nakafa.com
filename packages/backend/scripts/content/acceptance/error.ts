import { Schema } from "effect";
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

  return sanitized
    .trim()
    .split(WHITESPACE)
    .join(" ")
    .slice(-MAX_COMMAND_ERROR_LENGTH);
};

/** Expected failure during isolated fixture preparation or local lifecycle control. */
export class AcceptanceRuntimeError extends Schema.TaggedError<AcceptanceRuntimeError>()(
  "AcceptanceRuntimeError",
  { message: Schema.String }
) {}

export const acceptanceRuntimeError = (message: string) =>
  new AcceptanceRuntimeError({ message });
