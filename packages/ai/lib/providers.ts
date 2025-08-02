import { createGateway } from "@ai-sdk/gateway";
import { customProvider } from "ai";
import { keys } from "../keys";

const gateway = createGateway({
  apiKey: keys().AI_GATEWAY_API_KEY,
});

const languageModels = {
  google: gateway("google/gemini-2.5-flash"),
  meta: gateway("meta/llama-4-maverick"),
  moonshot: gateway("moonshotai/kimi-k2"),
  openai: gateway("openai/gpt-4.1-nano"),
  qwen: gateway("alibaba/qwen3-coder"),
  zai: gateway("zai/glm-4.5"),
};

export const model = customProvider({
  languageModels,
});

export type ModelId = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels) as ModelId[];

export const defaultModel: ModelId = "google";
