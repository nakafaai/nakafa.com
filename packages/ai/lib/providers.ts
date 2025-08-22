import { createGateway } from "@ai-sdk/gateway";
import { customProvider } from "ai";
import { keys } from "../keys";

const gateway = createGateway({
  apiKey: keys().AI_GATEWAY_API_KEY,
});

const languageModels = {
  deepseek: gateway("deepseek/deepseek-r1-distill-llama-70b"),
  "google-default": gateway("google/gemini-2.5-flash"),
  "google-premium": gateway("google/gemini-2.5-pro"),
  meta: gateway("meta/llama-4-maverick"),
  moonshot: gateway("moonshotai/kimi-k2"),
  openai: gateway("openai/gpt-oss-120b"),
  qwen: gateway("alibaba/qwen-3-235b"),
  zai: gateway("zai/glm-4.5"),
};

export const model = customProvider({
  languageModels,
});

export type ModelId = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels) as ModelId[];

export const defaultModel: ModelId = "google-default";
