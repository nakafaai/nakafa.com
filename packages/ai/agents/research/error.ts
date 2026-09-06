import { ResearchGenerationError } from "@repo/ai/agents/research/schema";
import { NoObjectGeneratedError } from "ai";
import { Inspectable, Predicate } from "effect";

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

function describeCause(cause: unknown) {
  if (Predicate.isUndefined(cause)) {
    return;
  }
  return Predicate.isError(cause)
    ? cause.message
    : Inspectable.toStringUnknown(cause, 0);
}
