# ADR 0014: Every Model Call Goes Through One Gateway Module

## Status

Superseded by ADR 0019, which moves every model call to the Convex AI gateway.
The Vercel routing, key, and spend tags described below no longer hold. This is
part one; the Jev evaluation handle follows as part two.

## Context

Nina assembled each model call by hand. Nine call sites fetched a provider
model, attached the no-training routing constant and Gemini options, and picked
one of four timeout constants, and Nina classified provider failures by
inspecting AI SDK and gateway error classes itself. Nothing stopped a call from
sending its own `providerOptions.gateway`, so routing held only by convention,
and spend could not be told apart by purpose or by whose data a call carried.
Jev scoring, School AI, and retrieval for connected files all need the same
credentials, routing, deadlines, and failure vocabulary.

## Decision

`packages/backend/confect/gateway` is the only module that reaches the Vercel
AI Gateway. Callers ask the `Gateway` service for a language handle by purpose,
model key, and space, and pass the handle's model and timeout to the AI SDK or
Agent unchanged.

Each handle wraps the provider model with two middlewares. Gemini's reasoning
defaults for the purpose are outermost, so a call may still override them. The
routing middleware is innermost and replaces whatever `providerOptions.gateway`
a call sent: Gemini runs only on Google and Vertex, which do not train on
prompts, ordered by time to first token. The same middleware attributes spend
with the tags `space:<kind>` and `purpose:<purpose>`. A tenant space also sends
its tenant ID as the gateway `user`, so Vercel spend reports and budgets split
by school; a personal space sends no identifier, and no call names a person.

Every model error is classified once, by `classify`, into a `GatewayFailure`
whose reason, status, retry hint, retryability, gateway error type, and bounded
generation ID are the only facts that survive. The gateway client reports a
request that got no HTTP response (a refused connection, a deadline, an abort)
as a response error with an invented status 500, so `classify` reads the
failure inside it as `network`, `timeout`, or `interrupted` instead. Nina maps
those reasons onto its stored failure reasons and keeps the failure for
diagnostics. No module outside the gateway classifies a failed model call by
SDK error class, name, or HTTP status; output-parsing and tool-repair errors
(`NoObjectGeneratedError`, `NoSuchToolError`) stay with the code that parses
or repairs them.

`ModelKey` and the branded `ModelId` are declared once, in the client-safe
`gateway/model.ts`; Nina keeps only the credit price of each key.

## Implementation Contract

- `gateway/live.ts` holds the production layer: it reads `AI_GATEWAY_API_KEY`
  once per action and fails with `GatewayConfigurationError` before any request
  when the key is missing or blank. Nina's response actions provide it after
  claiming a turn, so a missing key settles the turn as `service-configuration`.
- `gateway/handle.ts` builds handles over one AI SDK provider. Tests use the
  same handles over deterministic models (`packages/backend/test/gateway.ts`),
  which also offers one representative failure per reason.
- Purposes are `chat`, `specialist`, `background`, `suggestion`, and
  `presentation`, each with today's deadlines and reasoning effort. A new
  purpose, model kind, or route is added in this module together with its
  first consumer.
- Outside this module, `scripts/check/gateway.ts` rejects any `@ai-sdk/gateway`
  import and any import, re-export, or namespace read of the AI SDK's `gateway`
  and `createGateway`. Outside tests it also rejects a `providerOptions` object
  with a `gateway` entry, whether written as a property, a variable, or an
  assignment, any write to `providerOptions.gateway`, and a gateway model ID
  string or template (`creator/model`) given as `model`, `languageModel`,
  `embeddingModel`, or `textEmbeddingModel`, which the AI SDK would send to its
  default gateway without routing. A value built elsewhere and passed by
  reference is beyond a syntax check; review covers it.
- `ai`, `@ai-sdk/gateway`, and `@ai-sdk/google` move as one exactly pinned
  catalog cohort (`AI_SDK_COHORT` in `scripts/dependencies/policy.ts`). Every
  bump rechecks the provider contracts this module relies on.
