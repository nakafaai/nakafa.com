import { createGateway } from "@ai-sdk/gateway";
import { customProvider } from "ai";
import { keys } from "../keys";

const gateway = createGateway({
  apiKey: keys().AI_GATEWAY_API_KEY,
  headers: {
    "http-referer": "https://nakafa.com",
    "x-title": "nakafa.com",
  },
});

const languageModels = {
  deepseek: gateway("deepseek/deepseek-v3.1"),
  "google-flash": gateway("google/gemini-2.5-flash"),
  "google-pro": gateway("google/gemini-2.5-pro"),
  meta: gateway("meta/llama-4-maverick"),
  "kimi-k2": gateway("moonshotai/kimi-k2-0905"),
  "openai-oss": gateway("openai/gpt-oss-120b"),
  "openai-gpt-5": gateway("openai/gpt-5-mini"),
  qwen: gateway("alibaba/qwen-3-235b"),
  zai: gateway("zai/glm-4.5"),
};

export const model = customProvider({
  languageModels,
});

export type ModelId = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels) as ModelId[];

export const defaultModel: ModelId = "google-flash";

export const order = ["cerebras", "groq", "baseten", "azure", "vertex"];
