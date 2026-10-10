import { classify } from "@repo/backend/confect/gateway/failure";
import { ResearchGenerationError } from "@repo/backend/confect/nina/research/schema";
import { NoObjectGeneratedError } from "ai";
import { Effect } from "effect";

/**
 * Turns whatever a research model call raised into the phase's typed error. An
 * answer the SDK could not read as the asked object is `rejected`; every other
 * failure is classified through the gateway's one vocabulary.
 */
export function makeResearchGenerationError(
  error: unknown,
  phase: ResearchGenerationError["phase"]
) {
  if (NoObjectGeneratedError.isInstance(error)) {
    return new ResearchGenerationError({
      message: `Research ${phase} returned no usable answer.`,
      phase,
      rejected: true,
    });
  }
  return new ResearchGenerationError({
    gateway: classify(error),
    message: `Research ${phase} generation failed.`,
    phase,
    rejected: false,
  });
}

/**
 * Records why a research phase failed. Nina and the learner only get the
 * capability's text, so the log is the one place the reason survives, as
 * routing facts without the task or the answer.
 */
export function logResearchFailure(error: ResearchGenerationError) {
  return Effect.logWarning("Nina research phase failed", {
    phase: error.phase,
    reason: error.gateway?.reason,
    rejected: error.rejected,
    status: error.gateway?.status,
    type: error.gateway?.type,
  });
}
