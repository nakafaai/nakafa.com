import type { GatewayProviderOptions } from "@ai-sdk/gateway";

/** Routes Gemini requests only through no-training Google providers. */
export const gatewayProviderOptions = {
  disallowPromptTraining: true,
  only: ["google", "vertex"],
  sort: "ttft",
} satisfies GatewayProviderOptions;
