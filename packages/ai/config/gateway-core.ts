import { createGateway, type GatewayModelId } from "@ai-sdk/gateway";
import { keys } from "@repo/ai/keys";

/** Creates an AI Gateway client after the caller enters an AI effect. */
function createNakafaGateway() {
  return createGateway({
    apiKey: keys().AI_GATEWAY_API_KEY,
    headers: {
      "http-referer": "https://nakafa.com",
      "x-title": "nakafa.com",
    },
  });
}

/** Creates a Convex-safe Gateway-backed language model without Node-only devtools. */
export function createGatewayLanguageModel(modelId: GatewayModelId) {
  return createNakafaGateway()(modelId);
}
