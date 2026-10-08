import { createGateway } from "@ai-sdk/gateway";
import { Gateway, make } from "@repo/backend/confect/gateway/handle";
import { apiKey, headers } from "@repo/backend/confect/gateway/key";
import { Effect, Layer, Redacted } from "effect";

/**
 * The production adapter: the Vercel AI Gateway with the deployment's key,
 * read once per action before any request.
 */
export const GatewayLive = Layer.effect(
  Gateway,
  Effect.map(apiKey, (key) =>
    make(createGateway({ apiKey: Redacted.value(key), headers }))
  )
);
