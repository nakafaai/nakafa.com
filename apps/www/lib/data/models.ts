import {
  Anthropic,
  DeepSeek,
  Gemini,
  Kimi,
  LongCat,
  Meta,
  Minimax,
  OpenAI,
  Qwen,
  XAI,
  ZAI,
} from "@lobehub/icons";
import type { ModelId } from "@repo/ai/config/vercel";
import type { ComponentType } from "react";

interface Model {
  icon: ComponentType;
  value: ModelId;
  label: string;
  type: "premium" | "free";
}

export const aiModels: Model[] = [
  {
    icon: Anthropic,
    value: "claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    type: "premium",
  },
  {
    icon: Anthropic,
    value: "claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    type: "premium",
  },
  {
    icon: Gemini,
    value: "gemini-3-pro",
    label: "Gemini 3 Pro",
    type: "premium",
  },
  {
    icon: Gemini,
    value: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    type: "premium",
  },
  {
    icon: Gemini,
    value: "gemini-3-flash",
    label: "Gemini 3 Flash",
    type: "premium",
  },
  {
    icon: OpenAI,
    value: "gpt-5.2",
    label: "GPT 5.2",
    type: "premium",
  },
  {
    icon: OpenAI,
    value: "gpt-5",
    label: "GPT 5",
    type: "premium",
  },
  {
    icon: XAI,
    value: "grok-4",
    label: "Grok 4",
    type: "premium",
  },
  {
    icon: Qwen,
    value: "qwen-3-max",
    label: "Qwen 3 Max",
    type: "premium",
  },
  {
    icon: Kimi,
    value: "kimi-k2.5",
    label: "Kimi K2.5",
    type: "free",
  },
  {
    icon: Kimi,
    value: "kimi-k2",
    label: "Kimi K2",
    type: "free",
  },
  {
    icon: Gemini,
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    type: "free",
  },
  {
    icon: XAI,
    value: "xai/grok-4.1-fast-reasoning",
    label: "Grok 4.1 Fast",
    type: "free",
  },
  {
    icon: OpenAI,
    value: "gpt-oss-120b",
    label: "GPT OSS 120B",
    type: "free",
  },
  {
    icon: OpenAI,
    value: "gpt-5-nano",
    label: "GPT 5 Nano",
    type: "free",
  },
  {
    icon: Minimax,
    value: "minimax-m2.1",
    label: "Minimax M2.1",
    type: "free",
  },
  {
    icon: Minimax,
    value: "minimax-m2",
    label: "Minimax M2",
    type: "free",
  },
  {
    icon: DeepSeek,
    value: "deepseek-v3.1",
    label: "DeepSeek V3.1",
    type: "free",
  },
  {
    icon: Meta,
    value: "llama-4-maverick",
    label: "Llama 4 Maverick",
    type: "free",
  },
  {
    icon: LongCat,
    value: "longcat-flash",
    label: "LongCat Flash",
    type: "free",
  },
  {
    icon: Qwen,
    value: "qwen-3-coder",
    label: "Qwen 3 Coder",
    type: "free",
  },
  {
    icon: ZAI,
    value: "glm-4.7",
    label: "GLM 4.7",
    type: "free",
  },
  {
    icon: ZAI,
    value: "glm-4.6",
    label: "GLM 4.6",
    type: "free",
  },
];

export function getPremiumModels() {
  return aiModels.filter((m) => m.type === "premium");
}

export function getFreeModels() {
  return aiModels.filter((m) => m.type === "free");
}
