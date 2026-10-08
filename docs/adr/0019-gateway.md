# ADR 0019: Every Model Call Goes Through The Convex AI Gateway

## Status

Accepted. Supersedes ADR 0014, which routed every model call through the
Vercel AI Gateway.

## Context

ADR 0014 made `packages/backend/confect/gateway` the only module that reaches a
model, through the Vercel AI Gateway. Its routing sent Gemini only to Google and
Vertex, which do not train on prompts, sorted by time to first token. Its spend
tags split reports by space and purpose, and a tenant space sent its tenant ID
as the gateway `user`. Google Search grounding ran through the same provider.

Nakafa now calls models only through the Convex AI gateway. Convex serves it
through `convexGateway` from `@convex-dev/ai-sdk-provider`, which sends each
request with the deployment's service token, so no gateway key is configured.
Nina keeps the Convex Agent component (`@convex-dev/agent`), which takes its
model from that provider. Effect AI is not used for the agent.

Convex rejects the routing options, documents no provider pinning or Google-only
controls, and states that zero data retention is enforced on every request, with
requests routed only to providers under a zero data retention agreement. Convex
does not pass provider-executed tools such as Google Search grounding through
its OpenAI-compatible endpoint.

## Probe Results

Measured on the dev deployment on 8 October 2026. Requests went to
`https://ai-gateway.convex.dev/v1` with `getServiceToken("ai-gateway")`, the
path `convexGateway` uses.

| Probe | Result |
| --- | --- |
| `GET /models` | 200. `google/gemini-3.5-flash-lite` and `google/gemini-3.7-flash` are listed, so stored model keys and ids stay as they are. |
| Plain chat, both models | 200 in 0.6 s and 2.3 s. `usage.cost` holds the US dollar cost of the call. |
| `reasoning_effort: "high"` on `gemini-3.7-flash` | 200. 357 reasoning tokens, and the reasoning summary comes back in `message.reasoning` without asking for it. `"low"` gives 189 reasoning tokens, no setting gives 377. |
| `reasoning_effort: "minimal"` on `gemini-3.5-flash-lite` | 200, 0 reasoning tokens. `"none"` is rejected with 400 ("Reasoning is mandatory for this endpoint"). |
| Function tools, `tool_choice: "required"`, and a tool result sent back | On `google/gemini-3.5-flash-lite` with no effort set, and on `google/gemini-3.7-flash` with `reasoning_effort: "high"`: 200 for both steps. No step sends reasoning details back. |
| `response_format` with a strict JSON schema | 200, valid JSON. |
| Streaming with `stream_options.include_usage` | 200. The last chunk carries `usage` with `cost`. Reasoning arrives in `delta.reasoning`. |
| A PDF as a `file` part with a data URL, a PNG as an `image_url` data URL | 200, both read correctly. |
| `provider`, `route`, `models`, `plugins`, `preset`, `transforms` | 400 `unsupported_parameter`: "Convex selects how a request is served." |
| Unknown model | 400 `{ "error": { "message": "... is not a valid model ID", "code": 400 } }`. |
| `tools: [{ type: "google_search" }]` and `web_search_options` | Ignored: the answer shows no search. Google Search grounding does not pass through this gateway. |

The installed adapter (`@ai-sdk/openai-compatible`, used by `convexGateway`)
maps `message.reasoning` and `delta.reasoning` to reasoning parts, sends
`reasoning_effort` from `providerOptions.convexGateway.reasoningEffort`, exposes
the cost as `providerMetadata.convexGateway.cost`, and drops provider-executed
tools with a warning.

## Decision

- **Provider.** `convexGateway` from `@convex-dev/ai-sdk-provider` 0.2.1 is
  imported only inside `packages/backend/confect/gateway`. `@ai-sdk/gateway` is
  imported nowhere. `ai` still installs it as its own dependency, which the
  dependency policy allows.
- **Models.** `nakafa-lite` runs `google/gemini-3.5-flash-lite` and
  `nakafa-pro` runs `google/gemini-3.7-flash`. Stored model keys and ids need no
  migration.
- **Routing.** None is sent. Convex rejects routing options and enforces zero
  data retention itself. `gateway/route.ts` is deleted.
- **Spend.** No tenant or person identifier goes to the gateway, so the `space`
  argument leaves `Gateway.language`. Nakafa records cost itself: each usage row
  keeps the `providerMetadata.convexGateway.cost` its calls report, summed per
  agent, model, and provider.
- **Reasoning.** `fast` purposes send `reasoning_effort: "low"` and `interactive`
  purposes send `"high"`. Each is a default set through
  `defaultSettingsMiddleware`, so a call may override it. Reasoning summaries
  need no extra flag.
- **Research.** Google Search grounding is removed. The evidence phase forces one
  Firecrawl `webSearch` step, then writes evidence notes with no tools.
  `grounding.ts`, its tests, the prompt sentences that promised grounding, and
  the `@ai-sdk/google` dependency go with it.
- **Availability.** `GatewayLive` reads the service token once per action. A
  deployment that cannot use the gateway, such as a free, local, or self-hosted
  one, fails with `GatewayConfigurationError` before any request.
- **Failures.** `gateway/failure.ts` keeps its reason vocabulary and carries
  routing facts only. It classifies an `APICallError` by its HTTP status, the
  gateway's error `type` or string `code`, and `Retry-After`. A request that
  never got a response, a timeout, and an abort classify as before.
- **Policy.** `scripts/check/gateway.ts` rejects any import of `@ai-sdk/gateway`,
  the AI SDK's `gateway` and `createGateway` exports, any import of
  `@convex-dev/ai-sdk-provider` outside `confect/gateway`, and, outside tests, a
  gateway model id string where the AI SDK takes a model.
- **Configuration.** `AI_GATEWAY_API_KEY` is removed from `turbo.json` and the
  acceptance environment. `CONVEX_INTERNAL_AI_GATEWAY_HOST` stays unset.
- **Dependencies.** `@convex-dev/ai-sdk-provider` joins the AI SDK cohort in
  `scripts/dependencies/policy.ts`. `@ai-sdk/gateway` and `@ai-sdk/google` leave
  the backend.

## Consequences

Given up:

- **Provider pinning.** Vercel's `only: [google, vertex]` route is gone. Convex
  selects how each request is served.
- **Time to first token.** Vercel's sort by time to first token has no Convex
  equivalent, so that latency is unknown. Purpose deadlines stay under Convex's
  30-minute action limit.
- **Google Search grounding.** The gateway cannot run it. Research evidence
  comes from Firecrawl web search and the sources it reads.
- **Gateway spend tags.** Spend splits come from Nakafa's own usage rows, by
  agent, model, and provider, not from gateway tags. Usage rows stored before
  this change have no cost.

Changed:

- **Failure reading.** A token read that fails inside a request, after the
  build-time check passed, reaches `classify` as a plain `Error` and reads as
  `unknown`. The provider reads the service token inside its own fetch, and the
  `@ai-sdk/provider-utils` that `@ai-sdk/openai-compatible` uses returns that
  error unchanged. Under the Vercel gateway a rejected key read as `auth`, which
  Nina stores as `service-configuration`. `GatewayLive` still fails a deployment
  that cannot call the gateway before any request.
- **Duplicate provider packages.** `@convex-dev/ai-sdk-provider` brings its own
  copies of the provider packages beside the AI SDK's: `@ai-sdk/provider` 4.0.3
  and 4.0.7 beside 4.0.24, and `@ai-sdk/provider-utils` 5.0.12 and 5.0.28 beside
  5.0.56. It also loads `@ai-sdk/openai` and `@ai-sdk/anthropic` when it is
  imported. Their bundle size is not measured.

Not yet established:

- Convex's public pages state zero data retention on every request. They state
  no no-training commitment and list no subprocessors for the gateway. Convex
  must confirm these terms in writing before the privacy and terms pages change.
  Those pages live in the Aksara repository and change in their own pull
  request.
- Cost and latency figures, bundle size, and whether the dev and production
  teams have the paid plan that the gateway requires were not measured here.
- `reasoning_effort` `low` and `high` on `google/gemini-3.5-flash-lite`, plain
  and with function tools. No probe measured them on the lite model, which is
  the default. Nine call sites send `low` to it and chat sends `high`, so a
  rejected value would fail each call that sends it. Until a probe records both
  values, those defaults stay unverified.

## Implementation Contract

- `gateway/model.ts` owns the model keys, their gateway model ids, and the
  reasoning effort of each effort.
- `gateway/handle.ts` builds every handle over one AI SDK provider, so the
  production adapter and tests set the same defaults.
- `gateway/live.ts` holds the production layer and the one service token read.
- `gateway/failure.ts` owns `GatewayConfigurationError` and the classifier.
- `nina/usage.spec.ts`, `nina/usage.ts`, and `nina/usage.impl.ts` record cost per
  usage row.
- `scripts/check/gateway.ts` enforces the boundary in source.
