# Research Citation Flow

Research evidence has two separate surfaces:

- `data-web-search` renders the source tray.
- Markdown links render inline citations inside assistant text.

```mermaid
flowchart TD
  User["User asks for source-backed answer"] --> Orchestrator["Nina orchestrator"]
  Orchestrator --> Research["deepResearch tool"]
  Research --> WebSearch["webSearch / Google grounding"]
  WebSearch --> Sources["Structured sources"]
  WebSearch --> Draft["Research markdown"]
  Sources --> Normalize["normalizeResearchCitations()"]
  Draft --> Normalize
  Normalize --> Linked["Research markdown with [source](url) links"]
  Linked --> Orchestrator
  Orchestrator --> Final["Final answer"]
  Final --> Response["Response markdown renderer"]
  Response --> Anchor["markdown Anchor"]
  Anchor --> Source["Source chip with favicon"]
```

## Invariants

- Research output passed back to Nina must use markdown links, not numeric
  markers like `[4, 21, 23]`.
- The UI must not guess citations from arbitrary bracketed text. It renders real
  markdown links and structured `data-*` parts.
- Numeric citation indexes are normalized only when the same research artifact
  contains an indexed markdown source list.
- `data-web-search` remains a source overview; inline citation links remain part
  of markdown text.

## Why

```mermaid
flowchart LR
  Plain["[4, 21, 23] plain text"] --> Broken["User sees confusing numbers"]
  Link["[ByteByteGo](https://...) markdown"] --> Anchor["Anchor renderer"]
  Anchor --> Chip["Readable source chip"]
```

AI SDK source parts and custom `data-*` parts are separate from text parts, so
inline citations need explicit markdown links before the response reaches the
markdown renderer.

## References

- AI SDK sources: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#sources
- AI SDK stream protocol: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- AI Elements inline citation: https://elements.ai-sdk.dev/components/inline-citation
