import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { createWrappedLanguageModel } from "@repo/ai/config/gateway";
import { MODEL_IDS, modelRegistry } from "@repo/ai/config/models";
import { customProvider } from "ai";

type WrappedModel = ReturnType<typeof createWrappedLanguageModel>;
type LanguageModelMap = { [K in keyof typeof modelRegistry]: WrappedModel };

const languageModels: LanguageModelMap = Object.assign(
  {},
  ...MODEL_IDS.map((id) => ({
    [id]: createWrappedLanguageModel(modelRegistry[id].gatewayId),
  }))
);

export const model = customProvider({
  languageModels,
});

export const order = ["cerebras", "groq", "baseten", "azure", "vertex"];

export type GatewayProvider = GatewayProviderOptions;
export type GoogleProvider = GoogleGenerativeAIProviderOptions;
export type OpenAIProvider = OpenAIResponsesProviderOptions;
