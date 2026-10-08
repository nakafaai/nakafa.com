import { Cause, Option } from "effect";
/** Converts an unknown failure value into a concise human-readable message. */
export const getUnknownMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
/** Formats an Effect cause for CLI output, preferring the original failure message. */
export const formatScriptCause = (cause: Cause.Cause<unknown>) => {
  const failure = Cause.findErrorOption(cause);
  if (Option.isSome(failure)) {
    return getUnknownMessage(failure.value);
  }
  return Cause.pretty(cause);
};
