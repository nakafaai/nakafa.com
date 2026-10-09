import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { Cause, Option } from "effect";
/** Formats an Effect cause for CLI output, preferring the original failure message. */
export const formatScriptCause = (cause: Cause.Cause<unknown>) => {
  const failure = Cause.findErrorOption(cause);
  if (Option.isSome(failure)) {
    return getUnknownErrorMessage(failure.value);
  }
  return Cause.pretty(cause);
};
