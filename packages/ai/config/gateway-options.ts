import type { GatewayProviderOptions } from "@ai-sdk/gateway";

/** Keeps AI Gateway free to route across available providers and fail over. */
export const gatewayProviderOptions = {
  sort: "ttft",
} satisfies GatewayProviderOptions;
