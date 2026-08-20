import type { GatewayProviderOptions } from "@ai-sdk/gateway";

/** Fails closed unless AI Gateway can use an OpenAI provider that does not train. */
export const gatewayProviderOptions = {
  disallowPromptTraining: true,
  only: ["openai"],
} satisfies GatewayProviderOptions;
