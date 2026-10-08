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
| Plain chat on `google/gemini-3.5-flash-lite` | 200 in 722 ms. `usage.cost` holds the US dollar cost of the call. |
| Plain chat on `google/gemini-3.7-flash` | 200 in 2312 ms. |
| `reasoning_effort: "high"` on `gemini-3.7-flash` | 200. 357 reasoning tokens, and the reasoning summary comes back in `message.reasoning` without asking for it. `"low"` gives 189 reasoning tokens, no setting gives 377. |
| `reasoning_effort: "minimal"` on `gemini-3.5-flash-lite` | 200, 0 reasoning tokens. `"none"` is rejected with 400 ("Reasoning is mandatory for this endpoint and cannot be disabled."). |
| `reasoning_effort` `low` and `high` on `google/gemini-3.5-flash-lite`, plain | 200. 290 reasoning tokens for `low` and 577 for `high` (`liteLow.json`, `liteHigh.json`). |
| `reasoning_effort` `low` and `high` on `google/gemini-3.5-flash-lite` with a required function tool | 200. 0 reasoning tokens for `low` and 96 for `high`, and the tool call comes back (`liteLowTool.json`, `liteHighTool.json`). |
| Function tools, `tool_choice: "required"`, and a tool result sent back | On `google/gemini-3.5-flash-lite` with no effort set, and on `google/gemini-3.7-flash` with `reasoning_effort: "high"`: 200 for both steps. No step sends reasoning details back. |
| `response_format` with a strict JSON schema | 200, valid JSON. |
| Streaming with `stream_options.include_usage` | 200. The last chunk carries `usage` with `cost`. Reasoning arrives in `delta.reasoning`. |
| A PDF as a `file` part with a data URL, a PNG as an `image_url` data URL | 200, both read correctly. |
| A PNG and a JPEG, 96 by 96 pixels, by Convex storage URL | 200 for the PNG and the JPEG on `google/gemini-3.5-flash-lite`, and 200 for the JPEG on `google/gemini-3.7-flash` (`pngStored96.json`, `jpgStored96.json`, `jpgStored96Pro.json`). |
| A PDF by Convex storage URL in a `file` part | 200. The gateway reads it (`pdfStored.json`). |
| An image URL on another host (Wikimedia Commons) | 400: the gateway's fetch of the image received a 400 status code (`imageUrl.json`). |
| `provider` | 400 `unsupported_parameter` with `param` `provider` and type `invalid_request_error`: "The `provider` parameter is not supported. Convex selects how a request is served." Measured (`rejectedProvider.json`). |
| `route`, `models`, `transforms`, `plugins`, `preset` | Documented as rejected with `unsupported_parameter` on Chat Completions, with no message given. Not probed. |
| Unknown model | 400 `{ "error": { "message": "... is not a valid model ID", "code": 400 } }`. |
| `tools: [{ type: "google_search" }]` and `web_search_options` | Ignored: the answer shows no search. Google Search grounding does not pass through this gateway. |
| The `:online` model suffix and the `openrouter:web_search` server tool | 200 with 3 and 2 annotations. `usage.cost` is 0.0282192 and 0.0282317 US dollars per call (`searchOnline.json`, `searchServerTool.json`). Not adopted, see Consequences. |

An 8 by 8 pixel PNG was refused by the provider both by Convex storage URL
(`imageStored.json`, 400) and as a data URL (`imageData.json`, 400), so the
refusal does not come from the URL form, while a 96 by 96 pixel PNG as a data
URL passed (`pngData96.json`, 200).

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
- **Attachments.** The documents of one turn, every attachment whose media type
  does not start with `image/`, may total at most 10 MiB (`NINA_DOCUMENT_SIZE`).
  Documents travel inside the request body, which the gateway accepts up to
  16 MiB. The adapter rejects a PDF given by URL, and `convexGateway` supports
  URLs only for images, so the AI SDK downloads every other document and the
  adapter inlines it as base64, which adds a third to its size. Images still go
  by Convex storage URL and are not counted. The consume step refuses the
  message before it deletes any upload grant, and the composer refuses it before
  the first upload starts.
- **Availability.** `GatewayLive` reads the service token once per action. A
  deployment that cannot use the gateway, such as a free, local, or self-hosted
  one, fails with `GatewayConfigurationError` before any request.
- **Failures.** `gateway/failure.ts` keeps its reason vocabulary and carries
  routing facts only. It classifies an `APICallError` by its HTTP status, the
  gateway's error `type` or string `code`, and `Retry-After`. A request that
  never got a response, a timeout, and an abort classify as before. The
  documented errors classify as below. The page documents no 402 and no 429
  response, so the classifier reads those by status alone.

  | Status | Code | Reason | Documented type |
  | --- | --- | --- | --- |
  | 401 | `invalid_api_key` | `auth` | `invalid_request_error` |
  | 400 | `unsupported_endpoint` | `invalid` | not documented |
  | 400 | `unsupported_parameter` | `invalid` | `invalid_request_error` for `provider` only |
  | 400 | `too_many_inputs` | `invalid` | not documented |
  | 413 | `request_too_large` | `too-large` | not documented |
  | 502, 503 | `upstream_error` | `unavailable` | not documented |

  The error body is `{ "error": { "message", "type", "code", "param" } }`, and
  `param` appears only when present. Provider validation errors, such as an
  unknown model, keep the provider's status and have no documented code or
  type. `Retry-After` is documented for Chat Completions and is forwarded when
  present.
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
- **Google Search grounding.** The gateway does not pass Google's grounding tool.
  Its own web search, through the `:online` suffix or the `openrouter:web_search`
  tool, returns annotations at about 0.028 US dollars per call, but the adapter
  does not map the annotations to AI SDK sources, so citations would be lost.
  Research evidence comes from Firecrawl web search and the sources it reads.
- **Gateway spend tags.** Spend splits come from Nakafa's own usage rows, by
  agent, model, and provider, not from gateway tags. Usage rows stored before
  this change have no cost.
- **Documents per turn.** A turn can no longer carry more than 10 MiB of
  documents (before: 10 files of 8 MiB by URL).

Changed:

- **Failure reading.** A token read that fails inside a request, after the
  build-time check passed, reaches `classify` as an error with no HTTP status,
  which reads as `unknown`. The provider reads the service token inside its own
  fetch, and the `@ai-sdk/provider-utils` that `@ai-sdk/openai-compatible` uses
  returns that error unchanged. Under the Vercel gateway a rejected key read as
  `auth`, which Nina stores as `service-configuration`. `GatewayLive` still fails
  a deployment that cannot call the gateway before any request.
- **Duplicate provider packages.** `@convex-dev/ai-sdk-provider` brings its own
  copies of the provider packages beside the AI SDK's: `@ai-sdk/provider` 4.0.3
  and 4.0.7 beside 4.0.24, and `@ai-sdk/provider-utils` 5.0.12 and 5.0.28 beside
  5.0.56. It also loads `@ai-sdk/openai` and `@ai-sdk/anthropic` when it is
  imported. Their bundle size is not measured.

Stored data:

- **Usage provider.** Usage rows now store `provider` as `convexGateway.chat`,
  the id the AI SDK gives the chat models of `convexGateway`. Rows written before
  this change store `gateway`, the provider id of the Vercel gateway's language
  model. Only the stored value changes: `nina/usage.ts` still stores
  `event.provider`.
- **PostHog `gateway_*` properties.** These are the properties that
  `packages/analytics/posthog/exception.ts` declares and `nina/diagnostics.ts`
  sends.
  - `gateway_error_type` changes meaning. It now holds the gateway's error
    `type`, such as `invalid_request_error`, or its string `code` when the body
    names no type. It no longer holds the former gateway's error types.
  - `gateway_generation_id` disappears. Its schema field and the property
    `nina/diagnostics.ts` set are both removed, and the Convex error body has no
    generation identifier.
  - `gateway_model_id`, `gateway_status_code`, and `gateway_retryable` keep their
    names and sources: the Convex model id, the HTTP status, and the AI SDK's
    `isRetryable` flag.

Not yet established:

- Convex's public pages state zero data retention on every request. They state
  no no-training commitment and list no subprocessors for the gateway. Convex
  must confirm these terms in writing before the privacy and terms pages change.
  Those pages live in the Aksara repository and change in their own pull
  request.
- Cost and latency figures, bundle size, and whether the dev and production
  teams have the paid plan that the gateway requires were not measured here.

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
