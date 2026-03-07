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

export function createWrappedLanguageModel(
  modelId: Parameters<typeof gateway>[number]
) {
  const model = gateway(modelId);

  if (keys().NODE_ENV === "development") {
    return wrapLanguageModel({
      model,
      middleware: devToolsMiddleware(),
    });
  }

  return model;
}
