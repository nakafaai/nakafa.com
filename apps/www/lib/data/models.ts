import type { ModelId } from "@repo/ai/config/models";

interface Model {
  iconSrc: string;
  label: string;
  type: "premium" | "free";
  value: ModelId;
}

const logos = {
  anthropic: "/ai-logos/anthropic.svg",
  claude: "/ai-logos/claude.svg",
  deepseek: "/ai-logos/deepseek.svg",
  gemini: "/ai-logos/gemini.svg",
  kimi: "/ai-logos/kimi.svg",
  longcat: "/ai-logos/longcat.svg",
  meta: "/ai-logos/meta.svg",
  minimax: "/ai-logos/minimax.svg",
  openai: "/ai-logos/openai.svg",
  qwen: "/ai-logos/qwen.svg",
  xai: "/ai-logos/xai.svg",
  zai: "/ai-logos/zai.svg",
} as const;

export const aiModels: Model[] = [
  {
    iconSrc: logos.anthropic,
    value: "claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    type: "premium",
  },
  {
    iconSrc: logos.anthropic,
    value: "claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    type: "premium",
  },
  {
    iconSrc: logos.gemini,
    value: "gemini-3.1-pro",
    label: "Gemini 3.1 Pro",
    type: "premium",
  },
  {
    iconSrc: logos.gemini,
    value: "gemini-3-pro",
    label: "Gemini 3 Pro",
    type: "premium",
  },
  {
    iconSrc: logos.gemini,
    value: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    type: "premium",
  },
  {
    iconSrc: logos.gemini,
    value: "gemini-3-flash",
    label: "Gemini 3 Flash",
    type: "premium",
  },
  {
    iconSrc: logos.openai,
    value: "gpt-5.2",
    label: "GPT 5.2",
    type: "premium",
  },
  {
    iconSrc: logos.openai,
    value: "gpt-5",
    label: "GPT 5",
    type: "premium",
  },
  {
    iconSrc: logos.xai,
    value: "grok-4",
    label: "Grok 4",
    type: "premium",
  },
  {
    iconSrc: logos.qwen,
    value: "qwen-3-max",
    label: "Qwen 3 Max",
    type: "premium",
  },
  {
    iconSrc: logos.minimax,
    value: "minimax-m2.5",
    label: "Minimax M2.5",
    type: "premium",
  },
  {
    iconSrc: logos.zai,
    value: "glm-5",
    label: "GLM 5",
    type: "premium",
  },
  {
    iconSrc: logos.kimi,
    value: "kimi-k2-thinking",
    label: "Kimi K2 Thinking",
    type: "premium",
  },
  {
    iconSrc: logos.gemini,
    value: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    type: "free",
  },
  {
    iconSrc: logos.gemini,
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    type: "free",
  },
  {
    iconSrc: logos.kimi,
    value: "kimi-k2.5",
    label: "Kimi K2.5",
    type: "free",
  },
  {
    iconSrc: logos.kimi,
    value: "kimi-k2",
    label: "Kimi K2",
    type: "free",
  },
  {
    iconSrc: logos.xai,
    value: "grok-4.1-fast-reasoning",
    label: "Grok 4.1 Fast Reasoning",
    type: "free",
  },
  {
    iconSrc: logos.xai,
    value: "grok-4.1-fast-non-reasoning",
    label: "Grok 4.1 Fast",
    type: "free",
  },
  {
    iconSrc: logos.openai,
    value: "gpt-oss-120b",
    label: "GPT OSS 120B",
    type: "free",
  },
  {
    iconSrc: logos.openai,
    value: "gpt-5-nano",
    label: "GPT 5 Nano",
    type: "free",
  },
  {
    iconSrc: logos.minimax,
    value: "minimax-m2.1",
    label: "Minimax M2.1",
    type: "free",
  },
  {
    iconSrc: logos.minimax,
    value: "minimax-m2",
    label: "Minimax M2",
    type: "free",
  },
  {
    iconSrc: logos.deepseek,
    value: "deepseek-v3.1",
    label: "DeepSeek V3.1",
    type: "free",
  },
  {
    iconSrc: logos.meta,
    value: "llama-4-maverick",
    label: "Llama 4 Maverick",
    type: "free",
  },
  {
    iconSrc: logos.longcat,
    value: "longcat-flash",
    label: "LongCat Flash",
    type: "free",
  },
  {
    iconSrc: logos.qwen,
    value: "qwen-3-coder",
    label: "Qwen 3 Coder",
    type: "free",
  },
  {
    iconSrc: logos.zai,
    value: "glm-4.7",
    label: "GLM 4.7",
    type: "free",
  },
  {
    iconSrc: logos.zai,
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
