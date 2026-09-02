import { Schema } from "effect";
import stripAnsi from "strip-ansi";

const MAX_COMMAND_ERROR_LENGTH = 500;
const WHITESPACE = /\s+/u;

export class ContentRuntimeCiError extends Schema.TaggedError<ContentRuntimeCiError>()(
  "ContentRuntimeCiError",
  {
    message: Schema.String,
  }
) {}

export const contentRuntimeCiError = (message: string) =>
  new ContentRuntimeCiError({ message });

export const sanitizeRuntimeCommandError = (
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
    .slice(0, MAX_COMMAND_ERROR_LENGTH);
};

export const productionRuntimeReadError = (
  table: string,
  cause: unknown,
  sensitiveValues: readonly string[]
) => {
  const detail = sanitizeRuntimeCommandError(
    cause instanceof Error ? cause.message : String(cause),
    sensitiveValues
  );
  const message = `Production read for ${table} failed`;

  return contentRuntimeCiError(
    detail.length > 0 ? `${message}: ${detail}` : `${message}.`
  );
};
