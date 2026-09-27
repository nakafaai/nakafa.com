import { PostHog } from "@posthog/convex";
import { createOperationalException } from "@repo/analytics/posthog/exception";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { getModelGatewayId } from "@repo/backend/confect/nina/config/model";
import { NinaGenerationError } from "@repo/backend/confect/nina/failure";
import { Cause, Effect, Option, Schema } from "effect";

class NinaDiagnosticsError extends Schema.TaggedError<NinaDiagnosticsError>()(
  "NinaDiagnosticsError",
  {}
) {}

/** Preserve operational routing facts without recording conversation or provider payloads. */
export const reportFailure = Effect.fn("nina.diagnostics.report")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>,
  cause: Cause.Cause<unknown>
) {
  const error = Cause.findErrorOption(cause).pipe(
    Option.filter(Schema.is(NinaGenerationError)),
    Option.getOrElse(() => new NinaGenerationError({ reason: "unknown" }))
  );
  const properties = {
    source: "nina-response",
    operation: error.reason,
    model_id: turn.modelId,
    gateway_model_id: getModelGatewayId(turn.modelId),
    gateway_error_type: error.diagnostics?.type,
    gateway_status_code: error.diagnostics?.status,
    gateway_retryable: error.diagnostics?.retryable,
    gateway_generation_id: error.diagnostics?.generation,
  };
  yield* Effect.logError("Nina response interrupted", {
    turnId: turn._id,
    ...properties,
  });
  const ctx = yield* ActionCtx;
  yield* Effect.tryPromise({
    try: () =>
      new PostHog(components.posthog).captureException(ctx, {
        error: createOperationalException(error, properties),
        additionalProperties: properties,
      }),
    catch: () => new NinaDiagnosticsError(),
  }).pipe(
    Effect.catchTag("NinaDiagnosticsError", () =>
      Effect.logWarning("Nina diagnostics could not be queued.")
    )
  );
});
