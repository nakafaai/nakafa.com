import { ResearchGenerationError } from "@repo/backend/confect/nina/research/schema";
import { NoObjectGeneratedError } from "ai";
import { Effect, Inspectable, Predicate } from "effect";

// Enough of a rejected answer to see why it did not parse.
const REJECTED_TEXT_LENGTH = 200;

/** Preserves provider failures as the research phase's typed error. */
export function makeResearchGenerationError(
  error: unknown,
  phase: ResearchGenerationError["phase"]
) {
  if (phase === "synthesis" && NoObjectGeneratedError.isInstance(error)) {
    return new ResearchGenerationError({
      cause: describeCause(error.cause),
      message: `Research synthesis generation failed: ${error.message}`,
      phase,
      text: error.text,
    });
  }
  return new ResearchGenerationError({
    cause: describeCause(error),
    message: `Research ${phase} generation failed.`,
    phase,
  });
}

/**
 * Records why a research phase failed. Nina and the learner only get the
 * capability's text, so the log is the one place the cause survives.
 */
export function logResearchFailure(error: ResearchGenerationError) {
  return Effect.logWarning("Nina research phase failed", {
    cause: error.cause,
    message: error.message,
    phase: error.phase,
    text: error.text?.slice(0, REJECTED_TEXT_LENGTH),
  });
}

/** Reduces an unknown provider failure to text a log line can carry. */
export function describeCause(cause: unknown) {
  if (Predicate.isUndefined(cause)) {
    return;
  }
  return Predicate.isError(cause)
    ? cause.message
    : Inspectable.toStringUnknown(cause, 0);
}
