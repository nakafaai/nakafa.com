import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import type { Purpose } from "@repo/backend/confect/gateway/purpose";
import type { Space } from "@repo/backend/confect/space";
import type { LanguageModelMiddleware } from "ai";
import { Match } from "effect";

/** Gemini runs only on Google's no-training providers, fastest first token first. */
const gemini = {
  disallowPromptTraining: true,
  only: ["google", "vertex"],
  sort: "ttft",
} satisfies GatewayProviderOptions;

/**
 * The end user Vercel's spend reports and budgets group a call under: a
 * school for a tenant space, and no one for a personal space.
 */
const spender = Match.type<Space>().pipe(
  Match.discriminatorsExhaustive("kind")({
    personal: () => ({}),
    tenant: ({ tenantId }) => ({ user: tenantId }),
  })
);

/**
 * The innermost middleware of every language handle. It replaces whatever
 * `providerOptions.gateway` a call site sent with the route and the spend
 * attribution, so no call option can loosen routing. Attribution tags the
 * space kind and the purpose, and names a school but never a person.
 *
 * The AI SDK owns this callback contract, which returns a promise.
 */
export function routing(
  purpose: Purpose,
  space: Space
): LanguageModelMiddleware {
  const gateway = {
    ...gemini,
    tags: [`space:${space.kind}`, `purpose:${purpose}`],
    ...spender(space),
  } satisfies GatewayProviderOptions;
  return {
    transformParams: ({ params }) =>
      Promise.resolve({
        ...params,
        providerOptions: { ...params.providerOptions, gateway },
      }),
  };
}
