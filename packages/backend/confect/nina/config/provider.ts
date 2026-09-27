import { createGateway } from "@ai-sdk/gateway";
import {
  getModelGatewayId,
  type ModelId,
} from "@repo/backend/confect/nina/config/model";
import { Config, Effect, Redacted, Schema } from "effect";

export class GatewayConfigurationError extends Schema.TaggedError<GatewayConfigurationError>()(
  "GatewayConfigurationError",
  {
    message: Schema.String,
  }
) {}

/** Resolve deployment configuration inside the action that invokes the model. */
export const getGatewayModel = Effect.fn("ai.gateway.model")(function* (
  modelId: ModelId
) {
  const apiKey = yield* Config.Redacted("AI_GATEWAY_API_KEY").pipe(
    Effect.mapError(
      () =>
        new GatewayConfigurationError({
          message: "AI Gateway is not configured.",
        })
    )
  );
  if (!Redacted.value(apiKey).trim()) {
    return yield* new GatewayConfigurationError({
      message: "AI Gateway is not configured.",
    });
  }
  return createGateway({
    apiKey: Redacted.value(apiKey),
    headers: gatewayHeaders,
  })(getModelGatewayId(modelId));
});

const gatewayHeaders = {
  "http-referer": "https://nakafa.com",
  "x-title": "nakafa.com",
};
