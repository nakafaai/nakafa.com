# Agentic AI Migration Plan

## Overview

Migrate Nakafa's chat system to an **Orchestrator-Agent Architecture** with Nina as the main orchestrator.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│                         (React Components, Chat UI)                          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ POST /api/chat
                                    │ {message, model, context}
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHAT API ROUTE (Next.js)                             │
│                    apps/www/app/api/chat/route.ts                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  createOrchestratorAgent({writer, selectedModel, context})          │    │
│  │                                                                     │    │
│  │  Context:                                                           │    │
│  │  - url: current page URL                                            │    │
│  │  - currentPage: {locale, slug, verified}                            │    │
│  │  - currentDate: ISO string                                          │    │
│  │  - userLocation: {city, country}                                    │    │
│  │  - userRole: teacher/student/parent/admin                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ Nina's Prompt (packages/ai/prompt/agents/)
                                    │ - Uses createPrompt() utility
                                    │ - References Nina's personality
                                    │ - Context-aware instructions
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR AGENT (Nina)                            │
│                         packages/ai/agents/orchestrator.ts                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ToolLoopAgent                                                      │    │
│  │  ├── Model: User's selected model (dynamic)                         │    │
│  │  ├── Instructions: orchestratorPrompt(context)                      │    │
│  │  └── Tools:                                                         │    │
│  │      └── delegate: Spawns sub-agents                                │    │
│  │                                                                     │    │
│  │  Decision Logic:                                                    │    │
│  │  - Simple queries → Answer directly                                 │    │
│  │  - Single domain → Delegate to one agent                            │    │
│  │  - Complex/multi → Spawn multiple agents                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────────────────────┘
                           │
                           │ delegate tool
                           │ Uses async generators for streaming
                           │ Controls context via toModelOutput
                           ▼
              ┌────────────┼────────────┬─────────────────┐
              │            │            │                 │
              ▼            ▼            ▼                 ▼
┌───────────────────┐ ┌──────────┐ ┌─────────────────┐ ┌──────────────┐
│    RESEARCH       │ │   STUDY  │ │      MATH       │ │   (Direct)   │
│     AGENT         │ │   AGENT  │ │     AGENT       │ │   Response   │
└───────┬───────────┘ └────┬─────┘ └────────┬────────┘ └──────────────┘
│       │                  │                │                  │
│  ┌────▼────┐        ┌────▼────┐     ┌────▼────┐              │
│  │webSearch│        │getSubjects│    │calculator│              │
│  │ scrape  │        │getArticles│    └────┬────┘              │
│  └────┬────┘        │getContent │          │                   │
│       │             └────┬─────┘          │                   │
│       │                  │                │                   │
│       ▼                  ▼                ▼                   ▼
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    TOOL EXECUTION                               │  │
│  │                                                                 │  │
│  │  Each tool:                                                     │  │
│  │  1. writer.write({type: "data-xxx", data: {...}}) → UI          │  │
│  │  2. return "String result" → LLM (via toModelOutput)            │  │
│  │                                                                 │  │
│  │  Data Parts:                                                    │  │
│  │  - data-web-search    - data-calculator                         │  │
│  │  - data-get-articles  - data-scrape-url                         │  │
│  │  - data-get-subjects  - data-get-content                        │  │
│  │                                                                 │  │
│  │  Tool Output (to LLM):                                          │  │
│  │  "Found 5 articles about quantum physics..."                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         │ Stream via readUIMessageStream
                         │ toModelOutput controls context
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUB-AGENT RESULTS                                    │
│                                                                              │
│  Each agent returns:                                                         │
│  {                                                                           │
│    output: "Synthesized text result",      → Goes to Nina (parent)          │
│    usage: {input, output, total},                                           │
│    toolCalls: [...]                                                         │
│  }                                                                           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ Results flow back to Orchestrator
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NINA SYNTHESIZES RESPONSE                            │
│                                                                              │
│  Nina receives summaries from all sub-agents                                 │
│  - Context is controlled (not full tool outputs)                            │
│  - Synthesizes into final user-friendly response                            │
│  - Maintains Nina's personality throughout                                  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ Stream to UI
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PERSISTENCE                                     │
│                        Convex Database (convex/)                             │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────┐  │
│  │   chats     │◄───│  messages   │◄───│              parts              │  │
│  │             │    │             │    │                                 │  │
│  │ - userId    │    │ - chatId    │    │ - messageId                     │  │
│  │ - title     │    │ - role      │    │ - type (text/tool/data)         │  │
│  │ - type      │    │ - identifier│    │ - order                         │  │
│  │ - visibility│    │             │    │ - data-xxx fields               │  │
│  └─────────────┘    └─────────────┘    └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ mapDBMessagesToUIMessages()
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI RENDERING                                    │
│                                                                              │
│  Parts rendered based on type:                                               │
│  - text → Message bubble                                                     │
│  - data-web-search → WebSearchPart component                                │
│  - data-calculator → CalculatorPart component                               │
│  - data-get-content → ContentPart component                                 │
│  - etc.                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Principles

### 1. **Single Model Architecture**
- All agents use the **same model** (user's selected model)
- Passed through `selectedModel` parameter consistently
- No separate models per agent

### 2. **Data Flow Pattern**
```
Tool Execution:
  ├─→ UI: writer.write({type: "data-xxx", data: {...}})  [Structured data]
  └─→ LLM: return "String summary"  [via toModelOutput]
```

### 3. **Context Control**
- Parent (Nina) only sees **summaries**, not full tool outputs
- Prevents context bloat (100k tokens → 1k token summary)
- Uses `toModelOutput` to extract relevant info

### 4. **Streaming Architecture**
- Async generators (`async function*`) for real-time updates
- `readUIMessageStream` accumulates streaming messages
- User sees progress immediately

### 5. **No Barrel Files**
- Direct imports: `@repo/ai/agents/orchestrator`
- Not: `@repo/ai/agents`

### 6. **Object Parameters**
- `createAgent({ writer, selectedModel })`
- Better autocomplete, easier to extend

## Tool Categories

| Category | Tools | Agent |
|----------|-------|-------|
| **Research** | webSearch, scrape | Research Agent |
| **Study** | getSubjects, getArticles, getContent | Study Agent |
| **Math** | calculator | Math Agent |

## Migration Tasks

### Phase 1: Foundation
1. [Task 1.1: Agent Schemas](./task-1.1-agent-schemas.md) - Zod schemas for types
2. [Task 1.2: Agent Prompts](./task-1.2-agent-prompts.md) - Prompt files in `packages/ai/prompt/agents/`
3. [Task 1.3: Tool Registry](./task-1.3-tool-registry.md) - Categorized tool registry

### Phase 2: Sub-Agents
4. [Task 2.1: Research Agent](./task-2.1-research-agent.md) - Web search & scraping
5. [Task 2.2: Study Agent](./task-2.2-study-agent.md) - Nakafa content retrieval
6. [Task 2.3: Math Agent](./task-2.3-math-agent.md) - Mathematical calculations

### Phase 3: Orchestrator
7. [Task 3.1: Orchestrator](./task-3.1-orchestrator.md) - Main Nina agent with delegation

### Phase 4: Integration
8. [Task 4.1: Chat Route](./task-4.1-refactor-chat-route.md) - Refactor API route

### Phase 5: Testing
9. [Task 5.1: Agent Tests](./task-5.1-agent-tests.md) - Unit tests

## File Structure

```
packages/
├── ai/
│   ├── agents/
│   │   ├── schema.ts          # Zod schemas
│   │   ├── registry.ts        # Tool registry
│   │   ├── research.ts        # Research agent (webSearch, scrape)
│   │   ├── study.ts           # Study agent (getSubjects, getArticles, getContent)
│   │   ├── math.ts            # Math agent (calculator)
│   │   └── orchestrator.ts    # Main orchestrator
│   └── prompt/
│       └── agents/
│           ├── descriptions.ts # Centralized descriptions
│           ├── research.ts     # Research prompts
│           ├── study.ts        # Study prompts
│           ├── math.ts         # Math prompts
│           └── orchestrator.ts # Orchestrator prompts
└── backend/
    └── convex/
        └── chats/
            ├── schema.ts       # Chat/message/part schemas
            └── utils.ts        # UI mapping utilities

apps/
└── www/
    └── app/
        └── api/
            └── chat/
                └── route.ts    # Refactored chat API
```

## AI SDK Patterns

### Building Agents
- **ToolLoopAgent**: https://ai-sdk.dev/docs/agents/building-agents
- **Constructor**: `new ToolLoopAgent({ model, instructions, tools, stopWhen })`

### Subagents
- **Streaming**: https://ai-sdk.dev/docs/agents/subagents#streaming-subagent-progress
- **Context Control**: https://ai-sdk.dev/docs/agents/subagents#controlling-what-the-model-sees
- **Pattern**: `async function*` with `readUIMessageStream`

### Type Safety
- **InferAgentUIMessage**: End-to-end type safety for UI messages

## Implementation Notes

1. **Tool Output Pattern**: String to LLM, structured data to UI
2. **Streaming**: All sub-agents use async generators
3. **Context**: Controlled via `toModelOutput` (summary only to parent)
4. **Model**: Same model for all agents (user's selection)
5. **Personality**: Nina's personality preserved in all prompts
