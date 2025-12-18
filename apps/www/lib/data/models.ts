import { SiMeituan } from "@icons-pack/react-simple-icons";
import {
  Anthropic,
  DeepSeek,
  Gemini,
  Meta,
  Minimax,
  Moonshot,
  OpenAI,
  Qwen,
  XAI,
  ZAI,
} from "@lobehub/icons";
import type { ModelId } from "@repo/ai/lib/providers";
import type { ComponentType } from "react";

type Model = {
  icon: ComponentType;
  value: ModelId;
  label: string;
};

export const premiumModels: Model[] = [
  {
    icon: Anthropic,
    value: "claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
  },
  {
    icon: Anthropic,
    value: "claude-haiku-4.5",
    label: "Claude Haiku 4.5",
  },
  {
    icon: Gemini,
    value: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
  },
  {
    icon: Gemini,
    value: "gemini-3-pro",
    label: "Gemini 3 Pro",
  },
  {
    icon: Moonshot,
    value: "kimi-k2-thinking",
    label: "Kimi K2 Thinking",
  },
  {
    icon: OpenAI,
    value: "gpt-5",
    label: "GPT 5",
  },
  {
    icon: XAI,
    value: "grok-4",
    label: "Grok 4",
  },
  {
    icon: Qwen,
    value: "qwen-3-max",
    label: "Qwen 3 Max",
  },
];

export const freeModels: Model[] = [
  {
    icon: XAI,
    value: "xai/grok-4.1-fast-reasoning",
    label: "Grok 4.1 Fast",
  },
  {
    icon: Gemini,
    value: "gemini-3-flash",
    label: "Gemini 3 Flash",
  },
  {
    icon: Gemini,
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
  },
  {
    icon: OpenAI,
    value: "gpt-oss-120b",
    label: "GPT OSS 120B",
  },
  {
    icon: OpenAI,
    value: "gpt-5-nano",
    label: "GPT 5 Nano",
  },
  {
    icon: Minimax,
    value: "minimax-m2",
    label: "Minimax M2",
  },
  {
    icon: DeepSeek,
    value: "deepseek-v3.1",
    label: "DeepSeek V3.1",
  },
  {
    icon: Meta,
    value: "llama-4-maverick",
    label: "Llama 4 Maverick",
  },
  {
    icon: Moonshot,
    value: "kimi-k2",
    label: "Kimi K2",
  },
  {
    icon: SiMeituan,
    value: "longcat-flash",
    label: "LongCat Flash",
  },
  {
    icon: Qwen,
    value: "qwen-3-coder",
    label: "Qwen 3 Coder",
  },
  {
    icon: ZAI,
    value: "glm-4.6",
    label: "GLM 4.6",
  },
];

export const models = [...premiumModels, ...freeModels];
