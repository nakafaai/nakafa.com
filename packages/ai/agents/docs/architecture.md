# Nina Agent Architecture

Nina has one chat route and one external package Interface:
`NinaHarness.stream`. Math, Nakafa, and research are internal
LearningCapabilities used by the harness to collect bounded evidence before the
final answer.

## Flow

```mermaid
flowchart LR
  User["User asks Nina"] --> Route["apps/www /api/chat"]
  Route --> Harness["NinaHarness.stream"]
  Harness --> Check{"Verified page evidence needed?"}
  Check -- "yes" --> Forced["prepareStep: force Nakafa once"]
  Check -- "no" --> Source{"Latest user text names an external source?"}
  Source -- "yes" --> ResearchForced["prepareStep: force research once"]
  Source -- "no" --> Normal["normal ToolLoopAgent choice"]
  Forced --> Capabilities["internal LearningCapabilities"]
  ResearchForced --> Capabilities
  Normal --> Capabilities
  Capabilities --> Nakafa["Nakafa capability"]
  Capabilities --> Research["research capability"]
  Capabilities --> Math["math capability"]
  Nakafa --> Search["Convex full-text search"]
  Nakafa --> Content["contents Effect service"]
  Mcp["apps/mcp"] --> Search
  Mcp --> Content
  Research --> ResearchEvidence["source evidence phase"]
  ResearchEvidence --> ResearchSynthesis["structured synthesis"]
  Math --> MathEvidence["deterministic evidence"]
  Nakafa --> NakafaEvidence["content IDs and retrieved content"]
  ResearchSynthesis --> Envelope["EvidenceEnvelope"]
  MathEvidence --> Envelope
  NakafaEvidence --> Envelope
  Envelope --> Final["Nina answer synthesis"]
  Final --> Inline["research links inline, Nakafa source chips separate"]
```

## Docs Map

- [Research citation flow](./research-citations.md)
- [Query-scoped search UI](./query-scoped-search.md)
- [Math evidence scope](./math-evidence.md)

When an agent flow changes, update the closest doc here or add a small focused
doc. Prefer diagrams over long prose so each file stays skimmable.

## Current Page

```mermaid
sequenceDiagram
  participant Route as "/api/chat"
  participant Harness as "NinaHarness"
  participant Nakafa as "Nakafa capability"
  participant Content as "contents service"
  participant Convex as "chat parts"

  Route->>Convex: hydrate retained messages
  Route->>Harness: stream turn with validated context
  Harness->>Harness: check data-nakafa content for current URL
  alt verified and missing
    Harness->>Nakafa: force one current-page read on step 0
    Nakafa->>Content: read current content_ref directly
    Nakafa-->>Convex: persist data-nakafa kind content
  else unverified or already fetched
    Harness->>Harness: check latest user text for external source reference
    alt explicit external source
      Harness->>Harness: force research on step 0
    else no explicit external source
      Harness->>Harness: normal ToolLoopAgent choice
    end
  end
```

## Nakafa Evidence

```mermaid
flowchart LR
  User["User request"] --> Search["Nakafa search"]
  Search --> SetRef["exercise set ref"]
  Search --> ReadRef["content ref"]
  SetRef --> Exercise["exercise tool"]
  ReadRef --> Read["read tool"]
  Exercise --> StepResults["AI SDK step toolResults"]
  Read --> StepResults
  StepResults --> Evidence["Nakafa capability evidence text"]
  Evidence --> Envelope["EvidenceEnvelope"]
  Envelope --> Final["Nina answer synthesis"]
```

Search can return question-level exercise hits, but the handoff to the exercise
tool uses the parent set reference. A specific question number remains structured
tool input (`exercise_number`) instead of local prompt parsing. The Nakafa
capability returns collected AI SDK tool-result evidence, so user-facing prose is
composed by Nina from retrieved content rather than invented inside retrieval.
Exercise discovery uses the model-provided search input directly before
`selectExerciseRef` chooses a parent set. The Nakafa capability task is the
single Nakafa evidence request; there is no second raw-request planning layer
that can override or contaminate the search query.

## Contracts

- `packages/contents/_lib/agent` owns `read`, `exercise`, `quran`, `taxonomy`,
  and `verify`.
- Convex owns runtime search through `contentSearch`.
- Nina and MCP use the same search result contract.
- Nina stores one UI data envelope: `data-nakafa`.
- `data-nakafa.kind` decides the renderer: `search`, `content`, `exercise`,
  `quran`, or `taxonomy`.
- Search UI parts are query-scoped: one executed query writes one loading part
  and reconciles that same part to done or error.
- Research runs Firecrawl first for inspectable source rows, then Google Search
  grounding for corroboration. Google grounding appears in the source UI only
  when it has a query-scoped direct source.
- Provider identity is stored for traces and debugging, but the chat UI only
  shows user-relevant queries and sources.
- Research evidence exposes citation links beside the facts they support.
- Nakafa evidence exposes content IDs and retrieved content to the model while
  source previews render separately in the chat UI.
- Final answers cite external research inline only; Nakafa-owned content source
  links stay in the separate source preview UI.
- Math evidence carries both check status and derivation scope. A verified
  partial check is not a fully verified final derivation.
- Current-page fetch is deterministic through AI SDK `prepareStep`, `toolChoice`,
  and `activeTools`.
- Nakafa exercise search normalizes question-level refs to parent set refs before
  the exercise tool runs.
- Nakafa capability output is derived from AI SDK step `toolResults`, not from
  retrieval free-form prose.
- Explicit external source references are extracted by `@repo/ai/lib/source`.
  Routing uses them to enter research, and research receives the full ordered
  source list for exact-source reading.

## References

- AI SDK `prepareStep`: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
- Convex full-text search: https://docs.convex.dev/search/text-search
- Effect services: https://effect.website/docs/requirements-management/services/
