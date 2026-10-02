import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import type { Purpose } from "@repo/backend/confect/gateway/purpose";
import type { Space } from "@repo/backend/confect/space";
import type { LanguageModelMiddleware } from "ai";

/** Gemini runs only on Google's no-training providers, fastest first token first. */
const gemini = {
  disallowPromptTraining: true,
  only: ["google", "vertex"],
  sort: "ttft",
} satisfies GatewayProviderOptions;

/**
 * The innermost middleware of every language handle. It replaces whatever
 * `providerOptions.gateway` a call site sent with the route and the spend
 * attribution, so no call option can loosen routing. Attribution names the
 * space kind and the purpose as tags, never a person.
 */
export function routing(request: {
  readonly purpose: Purpose;
  readonly space: Space;
}): LanguageModelMiddleware {
  const gateway = {
    ...gemini,
    tags: [`space:${request.space.kind}`, `purpose:${request.purpose}`],
  } satisfies GatewayProviderOptions;
  return {
    transformParams: ({ params }) =>
      Promise.resolve({
        ...params,
        providerOptions: { ...params.providerOptions, gateway },
      }),
  };
}
