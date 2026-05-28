import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createGateway, type GatewayModelId } from "@ai-sdk/gateway";
import { keys } from "@repo/ai/keys";
import { wrapLanguageModel } from "ai";

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

/** Enables AI SDK DevTools only for local development workflows. */
function shouldUseDevTools(env: ReturnType<typeof keys>) {
  if (env.AI_SDK_DEVTOOLS !== "true") {
    return false;
  }

  // AI SDK DevTools throws in production mode and stores prompts, outputs,
  // and tool data locally in `.devtools/generations.json`.
  // Reference: https://ai-sdk.dev/docs/ai-sdk-core/devtools
  if (env.NODE_ENV === "production") {
    return false;
  }

  return env.VERCEL_ENV === undefined || env.VERCEL_ENV === "development";
}

/**
 * Creates the Gateway-backed language model used by all Nina model configs.
 *
 * AI SDK DevTools is intentionally local development-only because it stores
 * prompts, tool inputs, and outputs in plain text under `.devtools`.
 */
export function createWrappedLanguageModel(modelId: GatewayModelId) {
  const env = keys();
  const gateway = createNakafaGateway();
  const model = gateway(modelId);

  if (shouldUseDevTools(env)) {
    return wrapLanguageModel({
      model,
      middleware: devToolsMiddleware(),
    });
  }

  return model;
}
