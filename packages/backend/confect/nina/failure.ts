import { GatewayError } from "@ai-sdk/gateway";
import { NinaFailureReason } from "@repo/backend/confect/nina/turns.spec";
import {
  AISDKError,
  APICallError,
  NoOutputGeneratedError,
  RetryError,
} from "ai";
import { Schema } from "effect";

/** Only provider routing facts cross the diagnostic boundary. */
const Diagnostics = Schema.Struct({
  type: Schema.optional(Schema.String.check(Schema.isMaxLength(128))),
  status: Schema.optional(Schema.Finite),
  retryable: Schema.optional(Schema.Boolean),
  generation: Schema.optional(Schema.String.check(Schema.isMaxLength(128))),
});

export class NinaGenerationError extends Schema.TaggedError<NinaGenerationError>()(
  "NinaGenerationError",
  { reason: NinaFailureReason, diagnostics: Schema.optional(Diagnostics) }
) {}

export function generationFailure(cause: unknown): NinaGenerationError {
  let error = cause;
  for (let depth = 0; depth < 4; depth += 1) {
    if (RetryError.isInstance(error)) {
      error = error.lastError;
      continue;
    }
    if (NoOutputGeneratedError.isInstance(error) && error.cause) {
      error = error.cause;
      continue;
    }
    break;
  }
  const diagnostics = routingDiagnostics(error);
  if (GatewayError.isInstance(error) || APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 429:
        return new NinaGenerationError({
          diagnostics,
          reason: "provider-busy",
        });
      case 408:
      case 504:
        return new NinaGenerationError({
          diagnostics,
          reason: "response-timeout",
        });
      case 413:
        return new NinaGenerationError({
          diagnostics,
          reason: "input-too-large",
        });
      case 400:
      case 422:
        return new NinaGenerationError({
          diagnostics,
          reason: "request-rejected",
        });
      case 401:
      case 402:
      case 403:
      case 404:
      case 424:
        return new NinaGenerationError({
          diagnostics,
          reason: "service-configuration",
        });
      default:
        if (error.statusCode !== undefined && error.statusCode >= 500) {
          return new NinaGenerationError({
            diagnostics,
            reason: "provider-unavailable",
          });
        }
    }
  }
  // AI SDK replaces GatewayAuthenticationError at its public model boundary.
  if (AISDKError.isInstance(error) && error.name === "GatewayError") {
    return new NinaGenerationError({
      diagnostics,
      reason: "service-configuration",
    });
  }
  if (error instanceof Error) {
    switch (error.name) {
      case "TimeoutError":
        return new NinaGenerationError({
          diagnostics,
          reason: "response-timeout",
        });
      case "AbortError":
        return new NinaGenerationError({ diagnostics, reason: "interrupted" });
      case "GatewayAuthenticationError":
        return new NinaGenerationError({
          diagnostics,
          reason: "service-configuration",
        });
      default:
        break;
    }
  }
  return new NinaGenerationError({ diagnostics, reason: "unknown" });
}

const generationIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;

function routingDiagnostics(error: unknown) {
  if (GatewayError.isInstance(error)) {
    return {
      type: error.type,
      status: error.statusCode,
      retryable: error.isRetryable,
      generation:
        error.generationId && generationIdPattern.test(error.generationId)
          ? error.generationId
          : undefined,
    };
  }
  if (APICallError.isInstance(error)) {
    return { status: error.statusCode, retryable: error.isRetryable };
  }
}
