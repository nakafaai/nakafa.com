# ADR 0019: Every Model Call Goes Through The Convex AI Gateway

## Status

Accepted. Supersedes ADR 0014, which routed every model call through the
Vercel AI Gateway. The Jev decision route is alpha: no school grade uses a Jev
judgment until the zero-retention test in Decisions passes on the dev
deployment.

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
controls, and offers zero data retention per request: `provider.zdr: true`
restricts a request to endpoints with a zero data retention policy, and the
request fails when none matches (`docs.convex.dev/ai-gateway/api`, read on 13
October 2026). Convex does not pass provider-executed tools such as Google Search
grounding through its OpenAI-compatible endpoint.

## Probe Results

Measured on the dev deployment on 8 October 2026. Requests went to
`https://ai-gateway.convex.dev/v1` with `getServiceToken("ai-gateway")`, the
path `convexGateway` uses.

| Probe | Result |
| --- | --- |
| `GET /models` | 200. `google/gemini-3.5-flash-lite` and `google/gemini-3.7-flash` are listed. |
| Plain chat on `google/gemini-3.5-flash-lite` | 200 in 722 ms. `usage.cost` holds the US dollar cost of the call. |
| Plain chat on `google/gemini-3.7-flash` | 200 in 2312 ms. |
| `reasoning_effort: "high"` on `gemini-3.7-flash` | 200. 357 reasoning tokens, and the reasoning summary comes back in `message.reasoning` without asking for it. `"low"` gives 189 reasoning tokens, no setting gives 377. |
| `reasoning_effort: "minimal"` on `gemini-3.5-flash-lite` | 200, 0 reasoning tokens. `"none"` is rejected with 400 ("Reasoning is mandatory for this endpoint and cannot be disabled."). |
| `reasoning_effort` `low` and `high` on `google/gemini-3.5-flash-lite`, plain | 200. 290 reasoning tokens for `low` and 577 for `high` (`liteLow.json`, `liteHigh.json`). |
| `reasoning_effort` `low` and `high` on `google/gemini-3.5-flash-lite` with a required function tool | 200. 0 reasoning tokens for `low` and 96 for `high`, and the tool call comes back (`liteLowTool.json`, `liteHighTool.json`). |
| Function tools, `tool_choice: "required"`, and a tool result sent back | On `google/gemini-3.5-flash-lite` with no effort set, and on `google/gemini-3.7-flash` with `reasoning_effort: "high"`: 200 for both steps. No step sends reasoning details back. |
| `response_format` with a strict JSON schema | 200, valid JSON. |
| Streaming with `stream_options.include_usage` | 200. The last chunk carries `usage` with `cost`. Reasoning arrives in `delta.reasoning`. |
| Streaming with no `stream_options`, the request the adapter sends | 200. The last chunk still carries `usage` with `cost`, on both models (`streamPlainLite.json`, `streamPlainPro.json`, `streamPlainLiteLow.json`), so a streamed answer records its tokens and cost. |
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

### Decisions

Measured on the dev deployment on 12 October 2026, through `experimental_decide`
from `ai` 7.0.136 and the evaluation model of `@convex-dev/ai-sdk-provider`
0.2.1, with the HTTP route `POST /alpha/decisions`, the model
`typesafe/jev-1.13`, and two yes-or-no questions (`noul` on the wire,
`boolean` in the AI SDK) about each of 15 short messages in seven languages.
Each call took 140 to 310 ms and about 390 input tokens, and
`usage.cost` was 0.0000164 US dollars a call (0.042 US dollars per million
input tokens, output free). A request holds 64k tokens. The AI SDK warned
`The feature "providerOptions.convexGateway" is not supported` on every call:
the evaluation model of 0.2.1 sends no `provider` field.

| Message (shortened) | lasting | private |
| --- | --- | --- |
| id: grade 12 science, wants ITB informatics next year | 0.95 | 0.03 |
| id: what is the derivative of x^3 sin x | 0.03 | 0.01 |
| en: understands better with a worked example first | 0.92 | 0.01 |
| en: explain photosynthesis | 0.06 | 0.01 |
| de: exam on 3 November, integrals are hard | 0.97 | 0.03 |
| de: derivative of e^x | 0.04 | 0.01 |
| ja: third year of high school, Tokyo University next year, probability is hard | 0.97 | 0.03 |
| ja: how to solve a quadratic equation | 0.04 | 0.01 |
| ar: grade 11, organic chemistry is very hard | 0.95 | 0.02 |
| jv: grade 11, prefers learning with pictures | 0.93 | 0.02 |
| id: please explain again, still confused | 0.16 | 0.01 |
| id: an email address and a phone number | 0.06 | 0.93 |
| id: has diabetes and misses school, wants a study plan | 0.80 | 0.98 |
| id: thanks | 0.04 | 0.01 |
| es: prefers step by step, gets lost in long formulas | 0.92 | 0.01 |

The two questions were `lasting` ("The learner states something about
themselves that will still matter in later study sessions: their grade or
level, a goal, how they like to learn, something they find hard, or a situation
with a date such as an exam.") and `private` ("The message contains contact
details, a home address, an identity or account number, a password, or
information about health, religion, ethnicity, political views or money.").
The `private` question there said "message" where the catalog now says "text",
because it also judges a saved sentence with its quote. A third question,
`ownNote`, which asks whether a saved sentence reads as the learner's own note
and not as a description of the learner from the outside, was not measured
then. Fifteen messages say little about how a threshold behaves on many
languages and on texts that sit near it, so the thresholds in
`nina/judgment/catalog.ts` are not set from this table.
`pnpm --filter @repo/backend judgment:measure` runs a labelled set of 124
messages and 85 notes in 17 languages and 8 scripts through the deployment,
each judgment on the form of text that production asks it, one text to a
request (ADR 0022), and prints the probabilities by label, the counts at the
threshold the deployment reports and the threshold that separates best. The
thresholds in the catalog were set from what that command printed on 12 October
2026, and ADR 0022 holds the tables.

## Decision

- **Provider.** `convexGateway` from `@convex-dev/ai-sdk-provider` 0.3.0 is
  imported only inside `packages/backend/confect/gateway`. `@ai-sdk/gateway` is
  imported nowhere. `ai` still installs it as its own dependency, which the
  dependency policy allows. Release 0.3.0 (9 October 2026) is the first that
  puts `provider.zdr` on a Decisions request, which the decision model below
  needs (see Decisions).
- **Model.** Every language call runs `google/gemini-3.8-flash`, the one model
  that `gateway/model.ts` names for text. Learners cannot choose a model, so
  `Gateway.language(purpose)` takes only the purpose, and every Nina answer
  costs 5 credits. The model keys learners chose before October 2026 are
  gone: no function takes one and no stored row holds one.
- **Routing and retention.** No routing choice is sent: Convex rejects
  `provider.only` and the other routing fields. Every language model call does
  send `provider: { zdr: true, data_collection: "deny" }`, which the gateway
  accepts (measured 10 October 2026). `zdr: true` asks for endpoints with a zero
  data retention policy, and `data_collection: "deny"` excludes providers that
  collect data (`docs.convex.dev/ai-gateway/api`, read on 13 October 2026). No
  Convex page states zero data retention for every request. An embedding request
  cannot send the field: `@ai-sdk/openai-compatible` 3.0.14 builds its body from
  the model, the texts, the encoding format, `dimensions`, and `user` alone, and
  `convexGateway.embeddingModel` offers no way to add a field. The gateway's API
  accepts `provider` on Embeddings, so the limit sits in the adapter. Until the
  adapter can send the field, embedding requests carry no retention request, and
  no Convex statement covers how long they are kept. They carry published lesson
  and Quran text and the short search phrase that the specialist writes from a
  learner's question, never a stored learner message.
  `gateway/route.ts` is deleted.
- **Embeddings.** `Gateway.embed(texts, model)` returns one vector of
  `embeddingDimensions` numbers per text, from `embeddingModelId` in
  `gateway/model.ts` or from the candidate that the model test of knowledge
  search names. It fails with `GatewayFailure` when the reply does not match
  the request, and ends a call after `embeddingTimeoutMs`.
- **Prompt cache.** The gateway caches nothing on its own: a repeated prefix of
  53,624 tokens read zero cached tokens. `gateway/cache.ts` marks the last
  message before the newest user message with
  `cache_control: { type: "ephemeral" }`, so every later step of a turn reads
  the prefix the first step wrote. The provider keeps a prefix for about five
  minutes, in memory, and ignores one below about 4,000 tokens. Nina keeps her
  instructions and her tool list the same in every step of a turn, and usage
  rows record cached and reasoning tokens. Everything before the newest learner
  message repeats byte for byte, except what the learner or Nina added: the
  system prompt holds the static instructions, the page, the learner, the
  question focus, and the summary, in that order, and the history holds the
  complete turns after the summary. The facts that change from turn to turn, the
  date, the page URL, and the tool policy, travel in a block at the start of the
  newest learner message, which is never stored in the thread. Because the
  marker sits before that message, the block never makes the prefix change. The
  prefix does change when something in it does: the learner moves to a page
  with other content, a remembered fact changes, the learner retries an
  answer, which takes the replaced asking out of the history, or the summary
  folds the oldest turns of the history. The history, kept to 32,000 tokens,
  otherwise only grows at its end between folds, and a fold brings it down to
  16,000, so folds are about half a budget of turns apart. Between those events
  a turn adds only its question and answer to the prefix.
- **Spend.** No tenant or person identifier goes to the gateway, so the `space`
  argument leaves `Gateway.language`. Nakafa records cost itself: each usage row
  keeps the `providerMetadata.convexGateway.cost` its calls report, summed per
  agent, model, and provider.
- **Reasoning.** `fast` purposes send `reasoning_effort: "low"` and `interactive`
  purposes send `"high"`. Each is a default set through
  `defaultSettingsMiddleware`, so a call may override it. Reasoning summaries
  need no extra flag.
- **Research.** Google Search grounding is removed. Research forces one
  Firecrawl `webSearch` step and synthesizes from its results in a second
  call. A step with no tools after a tool call does not make the model write
  notes through the gateway (it emits another, invalid, tool call), so there is
  no notes step. `grounding.ts`, its tests, the prompt sentences that promised
  grounding, and the `@ai-sdk/google` dependency go with it. The search asks
  Firecrawl for results only and then reads the two best result pages itself,
  in parallel, each within 10 seconds. Measured on production on 10 October
  2026: a search that also read its five result pages took 76 seconds, a search
  alone 0.5 to 2.3 seconds, one page read 0.9 to 5.7 seconds, and the provider
  plan refuses more than about ten page reads a minute. A page that is not read
  keeps the description the search returned, so it is evidence, not a failure.
- **Search provider.** Research sends these to Firecrawl, over its HTTP API
  through Effect's HTTP client, from one module (`research/provider.ts`) that
  owns the requests, the answers it reads, and the failures it reports. The
  provider's SDK is not used. A search (`research/search/provider.ts`) sends the
  query that the research model writes from the learner's request and, when the
  learner's own words name sites, their hostnames as `includeDomains`
  ([ADR 0001](./0001-nina-engagement-architecture.md) says what the provider
  documents for that field). A page read (`research/tools/scrape.ts`) sends the
  address of a page, which is a link the learner gave or a result of a search.
  A search body holds `query`, `sources`, `limit`, `timeout` and
  `includeDomains`, a page read body holds `url`, `formats` and `timeout`, and
  the key travels as a bearer token. No other field is sent: the SDK also added
  an `origin` field naming its own version, which the reference does not define
  for either endpoint. Neither call sets a retention option, although the
  provider's API reference lists `enterprise: ["zdr"]` for a search and
  `zeroDataRetention` for a scrape (both read on 13 October 2026). Three
  Firecrawl pages were read on 12 October 2026. The Enterprise page lists zero
  data retention among the
  controls its team provisions, and says that page content and extracted data
  are then processed in memory and not kept beyond the request. The search page
  says that `["zdr"]` makes Firecrawl and its upstream search provider keep no
  query and no result, on an Enterprise plan. Neither page says how long a
  query, a site name or an address is kept when zero data retention is off, or
  what a search sends to its upstream provider. The privacy policy gives a
  retention rule for personal information only (kept until deletion is
  requested in writing) and none for requests to the API. So the retention of
  what Nakafa sends follows terms that no page states. Whether Nakafa's plan has
  zero data retention switched on is a fact of the account and is not in the
  repository, so this record claims nothing about it. The span of a search
  carries neither the query nor the sites, because both are derived from the
  learner's words. The repository sets up no tracer layer and no exporter, so no
  span leaves the process today, and an attribute kept on it would carry the
  learner's words out through a tracer added later.
  - Sites. The research model puts a site in a search only when the learner's
    own words name that site or its address. A request for an official, recent,
    or primary source names no site by itself, so unless the learner names one
    the search stays open and its queries carry the name of the source. A site
    that the model writes from memory can be wrong or no longer in use, and a
    search limited to it finds nothing.
    That happened on production: a learner asked for the latest official source
    of the UTBK SNBT 2027 schedule, and the research model limited both of its
    queries to `snpmb.bppp.kemdikbud.go.id`. The card said only that no source
    was found, and Nina answered that nothing could be verified. Measured on
    the production plan on 13 October 2026, a query limited to that domain
    returned no web and no news result, the same query limited to `snpmb.id`
    returned five of each, and the same query open returned five web results.
  - A limit that finds nothing. Every card of a search limited to sites carries
    them in every state (`research/tools/search.ts`), so a card can show them
    with its query. A search that was limited to sites and returned no source
    also tells Nina in words (`research/search/format.ts`), after whatever else
    the run answers from, such as a link of the learner's
    (`research/agent.ts`): which sites it was limited to, that none of them
    returned a page, that a site named from memory may be wrong or no longer in
    use, and that she should research again without the limit unless the
    learner named those sites. A search that returned a source, also one that
    cannot be cited, says nothing of its limit, and an open search that finds
    nothing adds nothing to what Nina reads. No code searches again or drops a
    site, because the learner may have named them on purpose, so whether to
    search again is Nina's step.
- **Attachments.** The documents of one turn, every attachment whose media type
  does not start with `image/`, may total at most 10 MiB (`NINA_DOCUMENT_SIZE`).
  Documents travel inside the request body, which the gateway accepts up to
  16 MiB. The adapter rejects a PDF given by URL, and `convexGateway` supports
  URLs only for images, so the AI SDK downloads every other document and the
  adapter inlines it as base64, which adds a third to its size. Images still go
  by Convex storage URL and are not counted. The consume step refuses the
  message before it deletes any upload grant, and the composer refuses it before
  the first upload starts. A retry applies the same limit to the stored
  message, because a turn stored before this change could hold up to 80 MiB of
  documents.
- **Availability.** `GatewayLive` reads the service token once per action. A
  deployment that cannot use the gateway, such as a free, local, or self-hosted
  one, fails with `GatewayConfigurationError` before any request.
- **Decisions.** A decision asks typed questions about one text and answers
  with a probability instead of writing text. `Gateway.decide(state,
  questions)` sends them to the Decisions route in one request, through the
  provider's evaluation model for `typesafe/jev-1.13` (Jev, named by
  `gateway/model.ts`), and answers with one typed answer for each question: a
  choice, a score, or a probability for a yes-or-no question. Nothing outside
  `confect/gateway` imports `ai`'s decide or the provider's evaluation model.
  Nina asks through `confect/nina/judgment` (ADR 0022), and `make(provider)`
  takes the decision model from the provider it is given, so tests pass a
  deterministic one as they pass a language model.
  - Zero retention. `make` asks the provider for the decision model with
    `{ zdr: true }`, and release 0.3.0 puts `provider: { zdr: true }` in the
    request. The provider's evaluation model has no option for
    `data_collection: "deny"`, so a decision asks for `zdr` alone, which the
    gateway documents as requiring an endpoint with a zero data retention
    policy. The AI SDK's `providerOptions` never reach a Decisions request (the
    evaluation model only turns them into warnings), so the flags of a language
    call could not be sent that way. `gateway/live.test.ts` asserts the body
    the production adapter sends. That the gateway serves a decision that asks
    for `zdr` is not yet proven (see Not yet established), and this ADR claims
    nothing more about it until it has been run against a deployment.
  - School grading (K6). A Jev judgment may inform a school grade only after the
    zero-retention test passes on the dev deployment: one decision request that
    asks for `zdr` is served by the gateway and returns an answer. Until then the
    decision route is alpha, and no code path that grades uses it. After the
    test passes, a Jev judgment is a suggestion that the teacher confirms, never
    a grade. It is one input to the teacher's grading queue, next to the answer
    key's own verdicts (K6, K7). A second opinion is a second Jev request, shown
    to the teacher only. If the test fails, teachers grade alone.
  - Name. The Jev call is `Gateway.decide` in code. `decide` also names the
    authorization check of ADR 0012, so the Jev call takes another name in a
    later change. This ADR does not choose that name.
  - One retry policy and one deadline. The AI SDK retries a failure the
    provider marks as retryable twice, after 2 and 4 seconds, and honors
    `Retry-After`. The whole call, retries included, ends after ten seconds
    (`decisionDeadline` in `gateway/purpose.ts`), aborts its request, and
    fails as a `timeout`.
  - Failures. A failure of any kind is a `GatewayFailure`, classified by the
    one `classify` that reads a failed language call. A model that refuses a
    question is a failure, and no answer is kept.
  - Cost. A call costs about 0.00002 US dollars (see Probe Results) and is not
    written to a usage row.
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
  `@convex-dev/ai-sdk-provider` outside `confect/gateway`, the AI SDK's
  `experimental_decide` and `experimental_evaluate` outside `confect/gateway`
  (by name, through a default or namespace import, and through `export *` or
  `export * as`), and, outside tests, a gateway model id string where the AI SDK
  takes a model.
- **Configuration.** `AI_GATEWAY_API_KEY` is removed from `turbo.json` and the
  acceptance environment. `CONVEX_INTERNAL_AI_GATEWAY_HOST` stays unset.
- **Dependencies.** `@convex-dev/ai-sdk-provider` joins the AI SDK cohort in
  `scripts/dependencies/policy.ts`. `@ai-sdk/gateway` and `@ai-sdk/google` leave
  the backend.
- **Package boundary (planned).** `ai` leaves the `apps/www` and
  `packages/design-system` manifests. The backend keeps `ai` in its own manifest,
  because the gateway seam imports it directly, and `@convex-dev/agent` lists `ai`
  only as a peer dependency. The backend's direct imports of `ai` move behind
  `confect/gateway` or another Confect seam, and a check rejects a new one. The
  change belongs to the first delivery wave of the School program.

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

- **Reasoning summaries on fast calls.** Under the Vercel gateway only
  `interactive` calls asked for summaries (`includeThoughts`). The Convex gateway
  returns a summary whenever the model writes one: `google/gemini-3.5-flash-lite`
  at `low` returned 239 characters in one plain call (`liteLow.json`) and none in
  a call with a required tool or in a streamed call (`liteLowTool.json`,
  `streamPlainLiteLow.json`). Nothing stores them: specialist and math repair
  calls run without a thread, and the repair, summary, memory, suggestion, and
  title calls save no messages. The Agent component saves a step only for a
  call that has a thread and does not set `saveMessages: "none"`.
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

- Convex's public pages do not state zero data retention on every request. The
  gateway API page makes it a per-request option (`provider.zdr`), and it says
  that `zdr: false` cannot disable a stricter gateway policy, which the page does
  not describe (`docs.convex.dev/ai-gateway/api`, read on 13 October 2026). Its
  subprocessor list names OpenRouter, Inc. for AI model routing in the United
  States (`convex.dev/legal/subprocessors`, read on 8 October 2026). No Convex
  page states a no-training commitment in those words, and none names which
  provider serves a Gemini request. The privacy policy of the Aksara repository
  (`packages/corpus/pages/privacy-policy/en.mdx`, lines 126 and 164) says that
  Convex enforces zero data retention on every gateway request. The Convex pages
  read for this record do not say that, so the sentence must be corrected in
  Aksara before a school signs.
- Cost and latency figures, bundle size, and whether the dev and production
  teams have the paid plan that the gateway requires were not measured here.
- Whether the gateway serves `typesafe/jev-1.13` to a request that asks for
  `zdr`. Convex documents that a request no zero data retention endpoint can
  serve fails, and its model list, checked on 9 October 2026, marks no Jev
  model as having such an endpoint (it names `typesafe/jev-router` without the
  mark and does not list `jev-1.13`). The decision request that asks for `zdr`
  has not been run against a deployment. If the gateway refuses it, every
  decision fails, Nina stores no memory, and `judgment:measure` says so for
  every message; no decision is made without asking for zero retention.
- Whether the research search step, given the rule that a site goes in a search
  only when the learner names it, leaves the field out for a request for an
  official source that names no site and puts the site in when the learner
  names one, and whether Nina researches again after she reads that a limit
  found nothing. Each is an instruction to a model, and no model call was made
  to test them.

## Implementation Contract

- `gateway/model.ts` owns the gateway model ids, the language model and the
  decision model, the provider id that usage rows store for a call through the
  gateway, and the reasoning effort of each effort. The release gate in
  [ADR 0001](./0001-nina-engagement-architecture.md) reads the language model id
  and the provider id back from a real turn.
- `gateway/handle.ts` builds every handle over one AI SDK provider, so the
  production adapter and tests set the same defaults. `gateway/decide.ts` owns
  the decision call: the AI SDK's decide, its one retry policy, and its
  deadline, which `gateway/purpose.ts` names.
- `nina/judgment` is the only caller of `Gateway.decide`.
- `gateway/live.ts` holds the production layer and the one service token read.
- `gateway/failure.ts` owns `GatewayConfigurationError` and the classifier.
- `nina/usage.spec.ts`, `nina/usage.ts`, and `nina/usage.impl.ts` record cost per
  usage row.
- `scripts/check/gateway.ts` enforces the boundary in source.
