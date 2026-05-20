import { Cause, Option, Schema } from "effect";

/** Represents a deliberate script failure that should make the CLI exit non-zero. */
export class ScriptFailureError extends Schema.TaggedError<ScriptFailureError>()(
  "ScriptFailureError",
  {
    message: Schema.String,
  }
) {}

/** Converts an unknown failure value into a concise human-readable message. */
export const getUnknownMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Formats an Effect cause for CLI output, preferring the original failure message. */
export const formatScriptCause = (cause: Cause.Cause<unknown>) => {
  const failure = Cause.failureOption(cause);

  if (Option.isSome(failure)) {
    return getUnknownMessage(failure.value);
  }

  return Cause.pretty(cause);
};
