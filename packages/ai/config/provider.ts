import {
  createGateway,
  type GatewayModelId,
  type GatewayProvider,
} from "@ai-sdk/gateway";
import { gatewayKeys } from "@repo/ai/keys";

/**
 * Plain AI Gateway provider configuration shared by server runtimes.
 *
 * This module intentionally has no DevTools import: `@ai-sdk/devtools` uses
 * Node built-ins at module load time, while Convex actions should stay in the
 * default runtime unless a provider genuinely requires Node APIs.
 */
let configuredGateway: GatewayProvider | undefined;

const gatewayHeaders = {
  "http-referer": "https://nakafa.com",
  "x-title": "nakafa.com",
};

/** Returns the Gateway provider after validating the runtime API key once. */
function readGatewayProvider() {
  if (configuredGateway) {
    return configuredGateway;
  }

  configuredGateway = createGateway({
    apiKey: gatewayKeys().AI_GATEWAY_API_KEY,
    headers: gatewayHeaders,
  });

  return configuredGateway;
}

/** Creates a Gateway language model through the validated runtime provider. */
export function gateway(modelId: GatewayModelId): ReturnType<GatewayProvider> {
  return readGatewayProvider()(modelId);
}
