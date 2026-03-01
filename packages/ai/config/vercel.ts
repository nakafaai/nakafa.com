import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { createWrappedLanguageModel } from "@repo/ai/config/gateway";
import { modelRegistry } from "@repo/ai/config/models";
import { customProvider } from "ai";

const languageModels = Object.fromEntries(
  Object.entries(modelRegistry).map(([key, def]) => [
    key,
    createWrappedLanguageModel(def.gatewayId),
  ])
);

export const model = customProvider({
  languageModels,
});

export const order = ["cerebras", "groq", "baseten", "azure", "vertex"];

export type GatewayProvider = GatewayProviderOptions;
export type GoogleProvider = GoogleGenerativeAIProviderOptions;
export type OpenAIProvider = OpenAIResponsesProviderOptions;
