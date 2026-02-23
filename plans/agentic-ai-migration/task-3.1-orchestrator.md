# Task 3.1: Create Orchestrator Agent

## Goal
Create the main orchestrator agent that delegates to sub-agents.

## Context
The orchestrator is Nina - the main entry point that decides which sub-agents to spawn based on user queries.

## Architecture

### Orchestrator Configuration
- **File**: `packages/ai/agents/orchestrator.ts`
- **Uses**: `orchestratorPrompt()` and `delegateToolDescription()` from prompts
- **Tools**: Single "delegate" tool that spawns sub-agents
- **Model**: User's selected model (dynamic)

### Agent Hierarchy

```
Orchestrator Agent (Nina)
├── delegate tool
    ├── Research Agent (webSearch, scrape)
    ├── Study Agent (getSubjects, getArticles, getContent)
    └── Math Agent (calculator)
```

### API Design

```typescript
// Constants
export const ORCHESTRATOR_MAX_STEPS = 15;

// Create orchestrator instance
export function createOrchestratorAgent({
  writer,
  selectedModel,
  context,
}: {
  writer: UIMessageStreamWriter<MyUIMessage>;
  selectedModel: ModelId;
  context: {
    url: string;
    currentPage: { locale: string; slug: string; verified: boolean };
    currentDate: string;
    userLocation: { city: string; country: string };
    userRole?: string;
  };
}): ToolLoopAgent

// Routing helper
export function routeToAgent({
  query,
  context,
}: {
  query: string;
  context?: { hasVerifiedSlug?: boolean };
}): { agent: AgentType | null; confidence: number }
```

### Key Features

1. **Single Model**: All agents use user's selected model
2. **Delegation Tool**: Uses async generators for streaming
3. **Context Control**: Uses `toModelOutput` to limit parent context
4. **Object Parameters**: All functions use object destructuring
5. **Type Exports**: Export `OrchestratorAgent` type

### Agent Routing Logic

```typescript
type AgentType = "research" | "study" | "math";

// Decision matrix:
// - web search queries → research agent
// - scrape/external URL → research agent  
// - Nakafa content (subjects, articles) → study agent
// - mathematical queries → math agent
// - mixed/complex → multiple agents
```

## AI SDK Patterns Used

1. **ToolLoopAgent**: Main orchestrator and sub-agents
   - Reference: https://ai-sdk.dev/docs/agents/building-agents#creating-an-agent

2. **Subagent Streaming**: `execute: async function*`
   - Reference: https://ai-sdk.dev/docs/agents/subagents#streaming-subagent-progress

3. **Context Control**: `toModelOutput` for limiting what parent sees
   - Reference: https://ai-sdk.dev/docs/agents/subagents#controlling-what-the-model-sees

4. **Abort Signal**: Passed through to sub-agents
   - Reference: https://ai-sdk.dev/docs/agents/subagents#handling-cancellation

## References

- **AI SDK Building Agents**: https://ai-sdk.dev/docs/agents/building-agents
- **AI SDK Subagents**: https://ai-sdk.dev/docs/agents/subagents
- **Current Chat Route**: `apps/www/app/api/chat/route.ts`
- **Model Config**: `packages/ai/config/vercel.ts`

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
