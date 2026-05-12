import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createGateway } from "@ai-sdk/gateway";
import { keys } from "@repo/ai/keys";
import { wrapLanguageModel } from "ai";

export const gateway = createGateway({
  apiKey: keys().AI_GATEWAY_API_KEY,
  headers: {
    "http-referer": "https://nakafa.com",
    "x-title": "nakafa.com",
  },
});

/** Enables AI SDK DevTools only for local development workflows. */
function shouldUseDevTools() {
  const env = keys();

  if (env.AI_SDK_DEVTOOLS !== "true") {
    return false;
  }

  if (env.NODE_ENV === "production") {
    return false;
  }

  return env.VERCEL_ENV === undefined || env.VERCEL_ENV === "development";
}

/**
 * Creates the Gateway-backed language model used by all Nina model configs.
 *
 * AI SDK DevTools is intentionally local-only because it stores prompts,
 * tool inputs, and outputs in plain text under `.devtools`.
 */
export function createWrappedLanguageModel(
  modelId: Parameters<typeof gateway>[number]
) {
  const model = gateway(modelId);

  if (shouldUseDevTools()) {
    return wrapLanguageModel({
      model,
      middleware: devToolsMiddleware(),
    });
  }

  return model;
}
