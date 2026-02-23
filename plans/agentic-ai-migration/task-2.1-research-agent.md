# Task 2.1: Create Research Agent

## Goal
Create the research sub-agent that handles web search and external content scraping.

## Context
Uses AI SDK's ToolLoopAgent with research category tools (webSearch, scrape).

## Architecture

### Agent Configuration
- **File**: `packages/ai/agents/research.ts`
- **Uses**: `researchAgentPrompt()` and `researchAgentDescription()` from prompts
- **Tools**: Research category from registry (webSearch, scrape)
- **Model**: Same as orchestrator (user's selected model)

### API Design

```typescript
// Create agent instance
export function createResearchAgent({
  writer,
  selectedModel,
}: {
  writer: UIMessageStreamWriter<MyUIMessage>;
  selectedModel: ModelId;
}): ToolLoopAgent

// Convenience function for one-off tasks
export async function runResearch({
  writer,
  selectedModel,
  task,
  abortSignal,
}: {
  writer: UIMessageStreamWriter<MyUIMessage>;
  selectedModel: ModelId;
  task: string;
  abortSignal?: AbortSignal;
}): Promise<{
  output: string;
  usage: TokenUsage;
  toolCalls: ToolCall[];
}>

// URL helpers for scraping
export function isExternalUrl(url: string): boolean
export function validateUrl(url: string): { valid: boolean; external: boolean; reason?: string }
export function extractUrlFromQuery(query: string): string | null
```

### Key Features

1. **Object Parameters**: All functions use object destructuring
2. **Type Exports**: Export `ResearchAgentMessage` type for UI
3. **Tool Integration**: Uses `getToolsByCategory({ category: "research", writer })`
4. **URL Validation**: Validates URLs before scraping (external only, no nakafa.com)

## References

- **AI SDK ToolLoopAgent**: https://ai-sdk.dev/docs/agents/building-agents#creating-an-agent
- **Current Research Tools**: `packages/ai/tools/web-search.ts`, `packages/ai/tools/scrape.ts`
- **Prompt Pattern**: `packages/ai/prompt/tools/calculator.ts`

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
