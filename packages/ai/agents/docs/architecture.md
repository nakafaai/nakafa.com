# Nina Agent Architecture

Nina has one chat route, one orchestrator, and three specialist agents. Nakafa
content is owned by `packages/contents/_lib/agent/service.ts`, so MCP and Nina
read the same contract.

## Flow

```mermaid
flowchart LR
  User["User asks Nina"] --> Route["apps/www /api/chat"]
  Route --> Check{"Verified page missing in retained context?"}
  Check -- "yes" --> Force["AI SDK prepareStep forces nakafa"]
  Check -- "no" --> Normal["Normal tool choice"]
  Force --> Orchestrator["orchestrator"]
  Normal --> Orchestrator
  Orchestrator --> Nakafa["nakafa agent"]
  Orchestrator --> Research["research agent"]
  Orchestrator --> Math["math agent"]
  Nakafa --> Service["Nakafa Effect service"]
  Mcp["apps/mcp tools"] --> Service
  Service --> Contents["packages/contents"]
  Research --> Web["web search and scrape"]
  Math --> Calc["calculator"]
```

## Current Page

```mermaid
sequenceDiagram
  participant Route as "/api/chat"
  participant Main as "orchestrator"
  participant Tool as "nakafa"
  participant Service as "Nakafa service"
  participant Convex as "Convex parts"

  Route->>Convex: hydrate retained messages
  Route->>Route: check data-nakafa content preview for current URL
  alt verified and missing
    Route->>Main: prepareStep forces nakafa on step 0
    Main->>Tool: one tool call
    Tool->>Service: direct read current content_ref
    Tool-->>Convex: data-nakafa kind content
  else unverified or already fetched
    Route->>Main: normal tool choice
  end
```

## Contracts

- `Nakafa.search`, `read`, `exercise`, `quran`, `taxonomy`, and `verify` are
  Effect service methods.
- MCP tools call the same service methods as Nina.
- Nina stores one UI data envelope: `data-nakafa`.
- `data-nakafa.kind` decides the renderer: `search`, `content`, `exercise`,
  `quran`, or `taxonomy`.
- Convex persists `tool-nakafa` and `data-nakafa` with explicit validators.
- Current-page fetch is deterministic through AI SDK `prepareStep`, `toolChoice`,
  and `activeTools`.

## References

- AI SDK `prepareStep`: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
- Effect services: https://effect.website/docs/requirements-management/services/
- Convex validators: https://docs.convex.dev/functions/validation
