import { devToolsMiddleware } from "@ai-sdk/devtools";
import { createGateway, type GatewayProviderOptions } from "@ai-sdk/gateway";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { keys } from "@repo/ai/keys";
import { customProvider, wrapLanguageModel } from "ai";

const gateway = createGateway({
  apiKey: keys().AI_GATEWAY_API_KEY,
  headers: {
    "http-referer": "https://nakafa.com",
    "x-title": "nakafa.com",
  },
});

/**
 * Create a wrapped language model with devToolsMiddleware
 * @param modelId - The model ID to wrap
 * @returns A wrapped language model with devToolsMiddleware
 */
function createWrappedLanguageModel(
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

const languageModels = {
  // Anthropic
  "claude-haiku-4.5": createWrappedLanguageModel("anthropic/claude-haiku-4.5"),
  "claude-sonnet-4.5": createWrappedLanguageModel(
    "anthropic/claude-sonnet-4.5"
  ),

  // DeepSeek
  "deepseek-v3.1": createWrappedLanguageModel("deepseek/deepseek-v3.1"),

  // Google
  "gemini-2.5-flash": createWrappedLanguageModel("google/gemini-2.5-flash"),
  "gemini-2.5-pro": createWrappedLanguageModel("google/gemini-2.5-pro"),
  "gemini-3-flash": createWrappedLanguageModel("google/gemini-3-flash"),
  "gemini-3-pro": createWrappedLanguageModel("google/gemini-3-pro-preview"),
  "gemini-3.1-pro": createWrappedLanguageModel("google/gemini-3.1-pro-preview"),

  // Meta
  "llama-4-maverick": createWrappedLanguageModel("meta/llama-4-maverick"),

  // Moonshot
  "kimi-k2": createWrappedLanguageModel("moonshotai/kimi-k2-0905"),
  "kimi-k2-thinking": createWrappedLanguageModel("moonshotai/kimi-k2-thinking"),
  "kimi-k2.5": createWrappedLanguageModel("moonshotai/kimi-k2.5"),

  // OpenAI
  "gpt-oss-120b": createWrappedLanguageModel("openai/gpt-oss-120b"),
  "gpt-5": createWrappedLanguageModel("openai/gpt-5"),
  "gpt-5-nano": createWrappedLanguageModel("openai/gpt-5-nano"),
  "gpt-5.2": createWrappedLanguageModel("openai/gpt-5.2"),

  // Meituan
  "longcat-flash": createWrappedLanguageModel("meituan/longcat-flash-chat"),

  // Minimax
  "minimax-m2.5": createWrappedLanguageModel("minimax/minimax-m2.5"),
  "minimax-m2.1": createWrappedLanguageModel("minimax/minimax-m2.1"),
  "minimax-m2": createWrappedLanguageModel("minimax/minimax-m2"),

  // Alibaba
  "qwen-3-coder": createWrappedLanguageModel("alibaba/qwen3-coder"),
  "qwen-3-max": createWrappedLanguageModel("alibaba/qwen3-max"),

  // XAI
  "xai/grok-4.1-fast-reasoning": createWrappedLanguageModel(
    "xai/grok-4.1-fast-reasoning"
  ),
  "xai/grok-4.1-fast-non-reasoning": createWrappedLanguageModel(
    "xai/grok-4.1-fast-non-reasoning"
  ),
  "grok-4": createWrappedLanguageModel("xai/grok-4"),

  // ZAI
  "glm-5": createWrappedLanguageModel("zai/glm-5"),
  "glm-4.7": createWrappedLanguageModel("zai/glm-4.7"),
  "glm-4.6": createWrappedLanguageModel("zai/glm-4.6"),
};

export const model = customProvider({
  languageModels,
});

export type ModelId = keyof typeof languageModels;

export const defaultModel: ModelId = "kimi-k2.5";

export const order = ["cerebras", "groq", "baseten", "azure", "vertex"];

export type GatewayProvider = GatewayProviderOptions;
export type GoogleProvider = GoogleGenerativeAIProviderOptions;
export type OpenAIProvider = OpenAIResponsesProviderOptions;
