import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import stripAnsi from "strip-ansi";

const MAX_COMMAND_ERROR_LENGTH = 2000;
const WHITESPACE = /\s+/u;

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
    .slice(-MAX_COMMAND_ERROR_LENGTH);
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

  return contentSnapshotError(
    detail.length > 0 ? `${message}: ${detail}` : `${message}.`
  );
};
