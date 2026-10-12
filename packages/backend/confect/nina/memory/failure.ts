import {
  classify,
  GatewayFailure,
} from "@repo/backend/confect/gateway/failure";
import { NoObjectGeneratedError } from "ai";
import { Effect, Schema } from "effect";

/**
 * Why a background memory call saved nothing: the capture of what a learner
 * said, or the build of their portrait. `operation` names the step that failed:
 * reading the prompt, judging the words with the decision model, asking the
 * model, or `unknown` for any other failure, such as a query or a write that
 * died. `rejected` marks an answer that did not fit the asked object, and
 * `gateway` classifies a failed call. None of them holds the message, a memory,
 * or the answer.
 */
export class NinaMemoryError extends Schema.TaggedError<NinaMemoryError>()(
  "NinaMemoryError",
  {
    gateway: Schema.optional(GatewayFailure),
    operation: Schema.Literals(["read", "judge", "generate", "unknown"]),
    rejected: Schema.Boolean,
  }
) {}

/** Turns what a model call raised into the typed error: a rejected answer, or the gateway's routing facts. */
export function generationFailure(error: unknown) {
  return NoObjectGeneratedError.isInstance(error)
    ? new NinaMemoryError({ operation: "generate", rejected: true })
    : new NinaMemoryError({
        gateway: classify(error),
        operation: "generate",
        rejected: false,
      });
}

/**
 * Turns a decision that could not be made into the typed error: the gateway's
 * routing facts, and nothing of the text that was judged. No decision means no
 * verdict, and the capture saves nothing for that turn.
 */
export function judgmentFailure(failure: GatewayFailure) {
  return new NinaMemoryError({
    gateway: failure,
    operation: "judge",
    rejected: false,
  });
}

/**
 * Records why a background call saved nothing. The learner never sees this, so
 * the log is the one place the reason survives, as routing facts without the
 * message or the answer.
 */
export function logFailure(message: string, error: NinaMemoryError) {
  return Effect.logWarning(message, {
    operation: error.operation,
    reason: error.gateway?.reason,
    rejected: error.rejected,
    status: error.gateway?.status,
    type: error.gateway?.type,
  });
}
