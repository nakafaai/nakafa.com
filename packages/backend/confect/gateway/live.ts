import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { Gateway, make } from "@repo/backend/confect/gateway/handle";
import { getServiceToken } from "convex/server";
import { Effect, Layer } from "effect";

/**
 * The production adapter: the Convex AI gateway. The deployment's service
 * token is read once per action, before any request; the provider reads it
 * again for each request. A decision model is the provider's evaluation model,
 * made with the options the handle gives it, among them the zero retention
 * request that the provider puts in the `provider` field of the request.
 *
 * It needs no Buffer in the global scope, which the default Convex runtime does
 * not have. The provider's chat adapter encodes the bytes of a file with
 * `btoa`. The AI SDK packages read the global `Buffer` without a guard in two
 * places only, both in the file encoders of the Vercel gateway client
 * (`@ai-sdk/gateway`: `maybeEncodeFileParts` of its language model and
 * `maybeEncodeBatchFileParts` of its batch client). No model call here reaches
 * that client (`scripts/check/gateway.ts` rejects its import).
 */
export const GatewayLive = Layer.effect(
  Gateway,
  Effect.as(
    Effect.tryPromise({
      try: () => getServiceToken("ai-gateway"),
      catch: () =>
        new GatewayConfigurationError({
          message: "The AI gateway is not available on this deployment.",
        }),
    }),
    make({
      decisionModel: (modelId, options) =>
        convexGateway.evaluationModel(modelId, options),
      embeddingModel: convexGateway.embeddingModel,
      languageModel: convexGateway,
    })
  )
);
