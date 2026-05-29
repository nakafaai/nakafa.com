import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { GatewayModelId } from "@ai-sdk/gateway";
import { createGatewayLanguageModel } from "@repo/ai/config/gateway-core";
import { keys } from "@repo/ai/keys";
import { wrapLanguageModel } from "ai";

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
  const model = createGatewayLanguageModel(modelId);

  if (shouldUseDevTools(env)) {
    return wrapLanguageModel({
      model,
      middleware: devToolsMiddleware(),
    });
  }

  return model;
}
