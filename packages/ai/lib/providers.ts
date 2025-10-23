import { createGateway, type GatewayProviderOptions } from "@ai-sdk/gateway";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { keys } from "@repo/ai/keys";
import { customProvider } from "ai";

const gateway = createGateway({
  apiKey: keys().AI_GATEWAY_API_KEY,
  headers: {
    "http-referer": "https://nakafa.com",
    "x-title": "nakafa.com",
  },
});

const languageModels = {
  // Anthropic
  "claude-haiku-4.5": gateway("anthropic/claude-haiku-4.5"),
  "claude-sonnet-4.5": gateway("anthropic/claude-sonnet-4.5"),

  // DeepSeek
  "deepseek-v3.1": gateway("deepseek/deepseek-v3.1"),

  // Google
  "gemini-2.5-flash": gateway("google/gemini-2.5-flash"),
  "gemini-2.5-pro": gateway("google/gemini-2.5-pro"),

  // Meta
  "llama-4-maverick": gateway("meta/llama-4-maverick"),

  // Moonshot
  "kimi-k2": gateway("moonshotai/kimi-k2-0905"),

  // OpenAI
  "gpt-oss-120b": gateway("openai/gpt-oss-120b"),
  "gpt-5": gateway("openai/gpt-5"),
  "gpt-5-nano": gateway("openai/gpt-5-nano"),

  // Meituan
  "longcat-flash": gateway("meituan/longcat-flash-chat"),

  // Alibaba
  "qwen-3-coder": gateway("alibaba/qwen3-coder"),
  "qwen-3-max": gateway("alibaba/qwen3-max"),

  // XAI
  "grok-4-fast": gateway("xai/grok-4-fast-reasoning"),
  "grok-4": gateway("xai/grok-4"),

  // ZAI
  "glm-4.6": gateway("zai/glm-4.6"),
};

export const model = customProvider({
  languageModels,
});

export type ModelId = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels) as ModelId[];

export const defaultModel: ModelId = "grok-4-fast";

export const order = ["cerebras", "groq", "baseten", "azure", "vertex"];

export type GatewayProvider = GatewayProviderOptions;
export type GoogleProvider = GoogleGenerativeAIProviderOptions;
export type OpenAIProvider = OpenAIResponsesProviderOptions;
