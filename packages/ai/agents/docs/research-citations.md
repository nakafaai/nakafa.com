# Research Citation Flow

Research evidence has two separate surfaces:

- `data-web-search` renders the source tray.
- Firecrawl `data-web-search` parts are query-scoped, so each query renders
  beside its own returned sources.
- Structured research output carries citation data.
- Markdown links are rendered from citation data before Nina sees the research result.
- Nina's final answer contract keeps citations inline and rejects terminal
  source sections.

```mermaid
flowchart TD
  User["User asks for source-backed answer"] --> Orchestrator["Nina orchestrator"]
  Orchestrator --> Research["deepResearch tool"]
  Research --> Evidence["Evidence phase (text mode)"]
  Evidence --> WebSearch["webSearch / scrape / Google grounding"]
  WebSearch --> Sources["Source evidence"]
  Sources --> Synthesis["Synthesis phase (Output.object)"]
  Synthesis --> Render["formatResearchOutput()"]
  Render --> Linked["Research markdown with inline [source](url) links"]
  Linked --> Orchestrator
  Orchestrator --> Final["Final answer"]
  Final --> Response["Response markdown renderer"]
  Response --> Anchor["markdown Anchor"]
  Anchor --> Source["Source chip with favicon"]
```

## Invariants

- Research synthesis uses AI SDK structured output, not free-form citation prose.
- Forced tool routing happens only during evidence collection, where provider
  response mode remains text.
- `Output.object()` happens only during synthesis, where tools are not active.
- Citation titles and URLs stay in structured fields until deterministic markdown
  rendering.
- The UI must not guess citations from arbitrary bracketed text. It renders real
  markdown links and structured `data-*` parts.
- `data-web-search` remains a source overview; inline citation links remain part
  of markdown text.

## Why

```mermaid
flowchart LR
  Plain["[4, 21, 23] plain text"] --> Broken["User sees confusing numbers"]
  Data["{ title, url } citation data"] --> Link["[ByteByteGo](https://...) markdown"]
  Link --> Anchor["Anchor renderer"]
  Anchor --> Chip["Readable source chip"]
```

AI SDK source parts and custom `data-*` parts are separate from text parts.
Research therefore returns structured citation data first, then the AI package
renders inline markdown links deterministically.

## References

- AI SDK sources: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#sources
- AI SDK stream protocol: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- AI Elements inline citation: https://elements.ai-sdk.dev/components/inline-citation
