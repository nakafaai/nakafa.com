import { keys } from "@repo/ai/keys";
import { createGateway, customProvider } from "ai";

const gateway = createGateway({
  apiKey: keys().AI_GATEWAY_API_KEY,
  headers: {
    "http-referer": "https://nakafa.com",
    "x-title": "nakafa.com",
  },
});

const anthropic = {
  "claude-haiku-4.5": gateway("anthropic/claude-haiku-4.5"),
  "claude-sonnet-4.5": gateway("anthropic/claude-sonnet-4.5"),
};

const deepseek = {
  "deepseek-v3.1": gateway("deepseek/deepseek-v3.1"),
};

const google = {
  "gemini-2.5-flash": gateway("google/gemini-2.5-flash"),
  "gemini-2.5-pro": gateway("google/gemini-2.5-pro"),
};

const meta = {
  "llama-4-maverick": gateway("meta/llama-4-maverick"),
};

const moonshot = {
  "kimi-k2": gateway("moonshotai/kimi-k2-0905"),
};

const openai = {
  "gpt-oss-120b": gateway("openai/gpt-oss-120b"),
  "gpt-5": gateway("openai/gpt-5"),
  "gpt-5-nano": gateway("openai/gpt-5-nano"),
};

const meituan = {
  "longcat-flash": gateway("meituan/longcat-flash-chat"),
};

const alibaba = {
  "qwen-3-coder": gateway("alibaba/qwen3-coder"),
  "qwen-3-max": gateway("alibaba/qwen3-max"),
};

const xai = {
  "grok-4-fast": gateway("xai/grok-4-fast-reasoning"),
  "grok-4": gateway("xai/grok-4"),
};

const zai = {
  "glm-4.6": gateway("zai/glm-4.6"),
};

const languageModels = {
  ...anthropic,
  ...deepseek,
  ...google,
  ...meta,
  ...moonshot,
  ...openai,
  ...meituan,
  ...alibaba,
  ...xai,
  ...zai,
};

export const model = customProvider({
  languageModels,
});

export type ModelId = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels) as ModelId[];

export const defaultModel: ModelId = "gpt-oss-120b";

export const order = ["cerebras", "groq", "baseten", "azure", "vertex"];
