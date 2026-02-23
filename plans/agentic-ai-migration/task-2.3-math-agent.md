# Task 2.3: Create Math Agent

## Goal
Create the math sub-agent for mathematical calculations.

## Context
Uses AI SDK's ToolLoopAgent with math category tools (calculator).

## Architecture

### Agent Configuration
- **File**: `packages/ai/agents/math.ts`
- **Uses**: `mathAgentPrompt()` and `mathAgentDescription()` from prompts
- **Tools**: Math category from registry (calculator)
- **Model**: Same as orchestrator (user's selected model)

### API Design

```typescript
// Create agent instance
// Reference: https://ai-sdk.dev/docs/agents/building-agents#creating-an-agent
export function createMathAgent({
  writer,
  selectedModel,
}: {
  writer: UIMessageStreamWriter<MyUIMessage>;
  selectedModel: ModelId;
}): ToolLoopAgent

// Convenience function for math tasks
// Reference: https://ai-sdk.dev/docs/agents/subagents
export async function performCalculation({
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
  usage: { input: number; output: number };
}>

// Helper functions for routing
export function isMathematicalQuery(query: string): number
export function shouldUseMathAgent(query: string): boolean
```

### Key Features

1. **ALWAYS Use Calculator**: No exceptions, even for simple math like 2+3
2. **Math Patterns**: Regex patterns to detect mathematical queries
3. **Object Parameters**: All functions use object destructuring
4. **Type Exports**: Export `MathAgentMessage` type for UI

## References

- **AI SDK ToolLoopAgent**: https://ai-sdk.dev/docs/agents/building-agents#creating-an-agent
- **AI SDK Subagents**: https://ai-sdk.dev/docs/agents/subagents
- **Current Calculator Tool**: `packages/ai/tools/calculator.ts`
- **Prompt Pattern**: `packages/ai/prompt/tools/calculator.ts`

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
