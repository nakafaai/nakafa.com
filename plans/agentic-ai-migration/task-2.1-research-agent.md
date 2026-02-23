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
 * @param writer - UIMessageStreamWriter for UI updates
 * @param selectedModel - Model ID selected by user (same as orchestrator)
 * @returns Configured ToolLoopAgent
 * 
 * @example
 * ```typescript
 * const agent = createResearchAgent(writer, "kimi-k2.5");
 * const result = await agent.generate({ prompt: "Research quantum computing" });
 * ```
 */
export function createResearchAgent(
  writer: UIMessageStreamWriter<MyUIMessage>,
  selectedModel: ModelId
) {
  return new ToolLoopAgent({
    // Uses the same model as orchestrator (user's selection)
    model: model.languageModel(selectedModel),
    instructions: researchAgentConfig.instructions,
    tools: getToolsByCategory("research", writer),
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
 * @param writer - UIMessageStreamWriter
 * @param selectedModel - Model ID selected by user
 * @param task - Research task description
 * @param options - Optional abort signal
 */
export async function runResearch(
  writer: UIMessageStreamWriter<MyUIMessage>,
  selectedModel: ModelId,
  task: string,
  options?: { abortSignal?: AbortSignal }
) {
  const agent = createResearchAgent(writer, selectedModel);
  
  const result = await agent.generate({
    prompt: task,
    abortSignal: options?.abortSignal,
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
