import { DeepSeek, Gemini, Moonshot, OpenAI, Qwen, XAI } from "@lobehub/icons";
import type { ModelId } from "@repo/ai/lib/providers";
import { HatGlassesIcon } from "lucide-react";
import type { ComponentType } from "react";

export const models: { icon: ComponentType; value: ModelId; label: string }[] =
  [
    {
      icon: OpenAI,
      value: "openai-oss",
      label: "GPT OSS 120b",
    },
    {
      icon: OpenAI,
      value: "openai-gpt-5",
      label: "GPT 5 Mini",
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
      icon: HatGlassesIcon,
      value: "sonoma-sky",
      label: "Sonoma Sky",
    },
    {
      icon: HatGlassesIcon,
      value: "sonoma-dusk",
      label: "Sonoma Dusk",
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
      icon: Qwen,
      value: "qwen-3",
      label: "Qwen 3 235B",
    },
    {
      icon: Qwen,
      value: "qwen-coder",
      label: "Qwen 3 Coder",
    },
    {
      icon: XAI,
      value: "grok-code",
      label: "Grok Code",
    },
  ];
