import type { GatewayModelId, GatewayProviderOptions } from "@ai-sdk/gateway";

/**
 * Model-level fallback used when the primary Gateway model fails or is unavailable.
 *
 * @see https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks
 */
export const fallbackGatewayModelIds = [
  "alibaba/qwen3.7-max",
  "minimax/minimax-m2.7",
  "zai/glm-5.1",
  "moonshotai/kimi-k2.6",
] as const satisfies readonly GatewayModelId[];

/** Keeps AI Gateway free to route across available providers and fail over. */
export const gatewayProviderOptions = {
  models: [...fallbackGatewayModelIds],
  sort: "ttft",
} satisfies GatewayProviderOptions;
