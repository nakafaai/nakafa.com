# Task 2.2: Create Study Agent

## Goal
Create the study sub-agent for retrieving Nakafa's educational content (subjects, articles, and full content).

## Context
Uses AI SDK's ToolLoopAgent with study category tools (getSubjects, getArticles, getContent). This agent handles all internal Nakafa content retrieval.

## Architecture

### Agent Configuration
- **File**: `packages/ai/agents/study.ts`
- **Uses**: `studyAgentPrompt()` and `studyAgentDescription()` from prompts
- **Tools**: Study category from registry (getSubjects, getArticles, getContent)
- **Model**: Same as orchestrator (user's selected model)

### API Design

```typescript
// Create agent instance
// Reference: https://ai-sdk.dev/docs/agents/building-agents#creating-an-agent
export function createStudyAgent({
  writer,
  selectedModel,
}: {
  writer: UIMessageStreamWriter<MyUIMessage>;
  selectedModel: ModelId;
}): ToolLoopAgent

// Convenience function for content retrieval
// Reference: https://ai-sdk.dev/docs/agents/subagents
export async function retrieveContent({
  writer,
  selectedModel,
  task,
  context,
  abortSignal,
}: {
  writer: UIMessageStreamWriter<MyUIMessage>;
  selectedModel: ModelId;
  task: string;
  context?: {
    currentSlug?: string;
    verified?: boolean;
  };
  abortSignal?: AbortSignal;
}): Promise<{
  output: string;
  usage: { input: number; output: number };
}>

// Helper to check if query is about Nakafa content
export function isContentQuery(query: string): boolean
```

### Key Features

1. **Verified Slugs Only**: Never guess or assume slugs - verify first
2. **Context-Aware**: Considers current page context for better content matching
3. **Object Parameters**: All functions use object destructuring
4. **Type Exports**: Export `StudyAgentMessage` type for UI
5. **Tool Integration**: Uses `getToolsByCategory({ category: "study", writer })`

## References

- **AI SDK ToolLoopAgent**: https://ai-sdk.dev/docs/agents/building-agents#creating-an-agent
- **AI SDK Subagents**: https://ai-sdk.dev/docs/agents/subagents
- **Current Content Tools**: `packages/ai/tools/content.ts`, `packages/ai/tools/subjects.ts`, `packages/ai/tools/articles.ts`
- **Prompt Pattern**: `packages/ai/prompt/tools/calculator.ts`

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
