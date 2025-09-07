import { DeepSeek, Gemini, Moonshot, OpenAI, ZAI } from "@lobehub/icons";
import type { ModelId } from "@repo/ai/lib/providers";
import type { ComponentType } from "react";

export const models: { icon: ComponentType; value: ModelId; label: string }[] =
  [
    {
      icon: OpenAI,
      value: "openai-oss",
      label: "GPT OSS 120b",
    },
    {
      icon: Gemini,
      value: "google-flash",
      label: "Gemini 2.5 Flash",
    },
    {
      icon: Gemini,
      value: "google-pro",
      label: "Gemini 2.5 Pro",
    },
    {
      icon: Moonshot,
      value: "kimi-k2",
      label: "Kimi K2",
    },
    {
      icon: DeepSeek,
      value: "deepseek",
      label: "DeepSeek V3.1",
    },
    {
      icon: ZAI,
      value: "zai",
      label: "GLM 4.5",
    },
  ];
