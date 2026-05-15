# Nina Agent Architecture

Nina has one chat route, one orchestrator, and three specialist agents. Nakafa
content reading is owned by `packages/contents`; Nakafa discovery is served by
the Convex `contentSearch` read model written during content sync.

## Flow

```mermaid
flowchart LR
  User["User asks Nina"] --> Route["apps/www /api/chat"]
  Route --> Check{"Verified page missing from retained chat?"}
  Check -- "yes" --> Forced["prepareStep: force nakafa once"]
  Check -- "no" --> Source{"Latest user text names an external source?"}
  Source -- "yes" --> ResearchForced["prepareStep: force research once"]
  Source -- "no" --> Normal["normal tool choice"]
  Forced --> Orchestrator["orchestrator"]
  ResearchForced --> Orchestrator
  Normal --> Orchestrator
  Orchestrator --> Nakafa["nakafa agent"]
  Orchestrator --> Research["research agent"]
  Orchestrator --> Math["math agent"]
  Nakafa --> Search["Convex full-text search"]
  Nakafa --> Content["contents Effect service"]
  Mcp["apps/mcp"] --> Search
  Mcp --> Content
  Research --> Web["web search and scrape"]
  Math --> Evidence["evaluate / simplify / differentiate / compare"]
```

## Docs Map

- [Research citation flow](./research-citations.md)

When an agent flow changes, update the closest doc here or add a small focused
doc. Prefer diagrams over long prose so each file stays skimmable.

## Current Page

```mermaid
sequenceDiagram
  participant Route as "/api/chat"
  participant Main as "orchestrator"
  participant Tool as "nakafa"
  participant Content as "contents service"
  participant Convex as "chat parts"

  Route->>Convex: hydrate retained messages
  Route->>Route: check data-nakafa content for current URL
  alt verified and missing
    Route->>Main: force nakafa on step 0
    Main->>Tool: one tool call
    Tool->>Content: read current content_ref directly
    Tool-->>Convex: persist data-nakafa kind content
  else unverified or already fetched
    Route->>Route: check latest user text for external source reference
    alt explicit external source
      Route->>Main: force research on step 0
    else no explicit external source
      Route->>Main: normal tool choice
    end
  end
```

## Contracts

- `packages/contents/_lib/agent` owns `read`, `exercise`, `quran`, `taxonomy`,
  and `verify`.
- Convex owns runtime search through `contentSearch`.
- Nina and MCP use the same search result contract.
- Nina stores one UI data envelope: `data-nakafa`.
- `data-nakafa.kind` decides the renderer: `search`, `content`, `exercise`,
  `quran`, or `taxonomy`.
- Current-page fetch is deterministic through AI SDK `prepareStep`, `toolChoice`,
  and `activeTools`.
- Explicit external source references are extracted by `@repo/ai/lib/source`.
  Routing uses them to enter research, and research receives the full ordered
  source list for exact-source reading.

## References

- AI SDK `prepareStep`: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
- Convex full-text search: https://docs.convex.dev/search/text-search
- Effect services: https://effect.website/docs/requirements-management/services/
