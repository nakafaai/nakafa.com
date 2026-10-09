// @ai-sdk/gateway encodes file bytes with the global Buffer, which the
// default Convex runtime does not have.
import "@repo/backend/confect/polyfills";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { Gateway, make } from "@repo/backend/confect/gateway/handle";
import { getServiceToken } from "convex/server";
import { Effect, Layer } from "effect";

/**
 * The production adapter: the Convex AI gateway. The deployment's service
 * token is read once per action, before any request; the provider reads it
 * again for each request.
 */
export const GatewayLive = Layer.effect(
  Gateway,
  Effect.as(
    Effect.tryPromise({
      try: () => getServiceToken("ai-gateway"),
      catch: () =>
        GatewayConfigurationError.make({
          message: "The AI gateway is not available on this deployment.",
        }),
    }),
    make({ languageModel: convexGateway })
  )
);
