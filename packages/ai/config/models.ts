export const modelRegistry = {
  // Alibaba
  "qwen-3-coder": {
    gatewayId: "alibaba/qwen3-coder",
    credits: 2,
  },
  "qwen-3-max": {
    gatewayId: "alibaba/qwen3-max",
    credits: 3,
  },

  // Anthropic
  "claude-haiku-4.5": {
    gatewayId: "anthropic/claude-haiku-4.5",
    credits: 2,
  },
  "claude-sonnet-4.5": {
    gatewayId: "anthropic/claude-sonnet-4.5",
    credits: 5,
  },

  // DeepSeek
  "deepseek-v3.1": {
    gatewayId: "deepseek/deepseek-v3.1",
    credits: 2,
  },

  // Google
  "gemini-2.5-flash": {
    gatewayId: "google/gemini-2.5-flash",
    credits: 1,
  },
  "gemini-2.5-pro": {
    gatewayId: "google/gemini-2.5-pro",
    credits: 3,
  },
  "gemini-3-flash": {
    gatewayId: "google/gemini-3-flash",
    credits: 1,
  },
  "gemini-3-pro": {
    gatewayId: "google/gemini-3-pro-preview",
    credits: 3,
  },
  "gemini-3.1-pro": {
    gatewayId: "google/gemini-3.1-pro-preview",
    credits: 4,
  },

  // Meta
  "llama-4-maverick": {
    gatewayId: "meta/llama-4-maverick",
    credits: 1,
  },

  // Minimax
  "minimax-m2": {
    gatewayId: "minimax/minimax-m2",
    credits: 1,
  },
  "minimax-m2.1": {
    gatewayId: "minimax/minimax-m2.1",
    credits: 1,
  },
  "minimax-m2.5": {
    gatewayId: "minimax/minimax-m2.5",
    credits: 2,
  },

  // MoonshotAI
  "kimi-k2": {
    gatewayId: "moonshotai/kimi-k2-0905",
    credits: 1,
  },
  "kimi-k2-thinking": {
    gatewayId: "moonshotai/kimi-k2-thinking",
    credits: 3,
  },
  "kimi-k2.5": {
    gatewayId: "moonshotai/kimi-k2.5",
    credits: 2,
  },

  // OpenAI
  "gpt-5": {
    gatewayId: "openai/gpt-5",
    credits: 4,
  },
  "gpt-5-nano": {
    gatewayId: "openai/gpt-5-nano",
    credits: 1,
  },
  "gpt-5.2": {
    gatewayId: "openai/gpt-5.2",
    credits: 4,
  },
  "gpt-oss-120b": {
    gatewayId: "openai/gpt-oss-120b",
    credits: 1,
  },

  // XAI
  "grok-4": {
    gatewayId: "xai/grok-4",
    credits: 5,
  },
  "xai/grok-4.1-fast-non-reasoning": {
    gatewayId: "xai/grok-4.1-fast-non-reasoning",
    credits: 1,
  },
  "xai/grok-4.1-fast-reasoning": {
    gatewayId: "xai/grok-4.1-fast-reasoning",
    credits: 2,
  },

  // ZAI
  "glm-4.6": {
    gatewayId: "zai/glm-4.6",
    credits: 2,
  },
  "glm-4.7": {
    gatewayId: "zai/glm-4.7",
    credits: 2,
  },
  "glm-5": {
    gatewayId: "zai/glm-5",
    credits: 3,
  },

  // Meituan
  "longcat-flash": {
    gatewayId: "meituan/longcat-flash-chat",
    credits: 1,
  },
} as const;

export type ModelId = keyof typeof modelRegistry;

export const defaultModel: ModelId = "kimi-k2.5";

export function getModelCreditCost(modelId: ModelId) {
  return modelRegistry[modelId].credits;
}

export function hasEnoughCredits(currentCredits: number, modelId: ModelId) {
  return currentCredits >= getModelCreditCost(modelId);
}

export function getModelGatewayId(modelId: ModelId) {
  return modelRegistry[modelId].gatewayId;
}
