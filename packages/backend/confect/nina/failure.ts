import {
  classify,
  GatewayFailure,
} from "@repo/backend/confect/gateway/failure";
import { NinaFailureReason } from "@repo/backend/confect/nina/turns.spec";
import { Schema } from "effect";

export class NinaGenerationError extends Schema.TaggedError<NinaGenerationError>()(
  "NinaGenerationError",
  {
    reason: NinaFailureReason,
    /** The gateway's routing facts when a model call failed. */
    gateway: Schema.optional(GatewayFailure),
  }
) {}

/**
 * The stored Nina reason for each gateway failure reason. A connection that
 * never reached the gateway reads as the provider being unavailable.
 */
const reasons = {
  "rate-limit": "provider-busy",
  quota: "service-configuration",
  auth: "service-configuration",
  configuration: "service-configuration",
  invalid: "request-rejected",
  "too-large": "input-too-large",
  timeout: "response-timeout",
  unavailable: "provider-unavailable",
  network: "provider-unavailable",
  interrupted: "interrupted",
  unknown: "unknown",
} satisfies Record<GatewayFailure["reason"], typeof NinaFailureReason.Type>;

/** Classifies a failed generation through the gateway's one vocabulary. */
export function generationFailure(cause: unknown): NinaGenerationError {
  const gateway = classify(cause);
  return new NinaGenerationError({ reason: reasons[gateway.reason], gateway });
}
