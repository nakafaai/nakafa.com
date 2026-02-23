# Task 2.1: Create Research Agent

## Goal
Create the research sub-agent that handles web search and content discovery

## Context
Uses AI SDK's ToolLoopAgent with research category tools. Uses the same model as orchestrator (user's selection).

## Implementation

**File**: `packages/ai/agents/research.ts`

```typescript
import { ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from "ai";
import { model, type ModelId } from "@repo/ai/config/vercel";
import { researchAgentPrompt } from "@repo/ai/prompt/agents/research";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { AgentConfigSchema } from "./schema";
import { getToolsByCategory } from "./registry";

/**
 * Research agent configuration
 */
export const researchAgentConfig = AgentConfigSchema.parse({
  id: "research",
  name: "Research Agent",
  description: "Specialized agent for web searches and content discovery",
  instructions: researchAgentPrompt(),
  maxSteps: 10,
});

/**
 * Create research agent instance
 * 
 * @param props - Configuration object
 * @param props.writer - UIMessageStreamWriter for UI updates
 * @param props.selectedModel - Model ID selected by user (same as orchestrator)
 * @returns Configured ToolLoopAgent
 * 
 * @example
 * ```typescript
 * const agent = createResearchAgent({
 *   writer,
 *   selectedModel: "kimi-k2.5"
 * });
 * const result = await agent.generate({ prompt: "Research quantum computing" });
 * ```
 */
export function createResearchAgent({
  writer,
  selectedModel,
}: {
  writer: UIMessageStreamWriter<MyUIMessage>;
  selectedModel: ModelId;
}) {
  return new ToolLoopAgent({
    // Uses the same model as orchestrator (user's selection)
    model: model.languageModel(selectedModel),
    instructions: researchAgentConfig.instructions,
    tools: getToolsByCategory({ category: "research", writer }),
    stopWhen: stepCountIs(researchAgentConfig.maxSteps),
  });
}

/**
 * Type for research agent messages
 * Used in UI for type-safe message rendering
 */
export type ResearchAgentMessage = InferAgentUIMessage<
  ReturnType<typeof createResearchAgent>
>;

/**
 * Run research task convenience function
 * 
 * @param props - Configuration object
 * @param props.writer - UIMessageStreamWriter
 * @param props.selectedModel - Model ID selected by user
 * @param props.task - Research task description
 * @param props.abortSignal - Optional abort signal
 */
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
}) {
  const agent = createResearchAgent({ writer, selectedModel });
  
  const result = await agent.generate({
    prompt: task,
    abortSignal,
  });
  
  return {
    output: result.text,
    usage: result.usage,
    toolCalls: result.toolCalls,
  };
}
```

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
