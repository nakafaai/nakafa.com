# Task 2.1: Create Research Agent

## Goal
Create the research sub-agent that handles web search and content discovery

## Context
Uses AI SDK's ToolLoopAgent with research category tools

## Implementation

**File**: `packages/ai/agents/research.ts`

```typescript
import { ToolLoopAgent, stepCountIs } from "ai";
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
 * @param agentModel - Model ID to use for this agent (from config/vercel.ts)
 * @returns Configured ToolLoopAgent
 * 
 * @example
 * ```typescript
 * const agent = createResearchAgent(writer, "claude-sonnet-4.5");
 * const result = await agent.generate({ prompt: "Research quantum computing" });
 * ```
 */
export function createResearchAgent(
  writer: UIMessageStreamWriter<MyUIMessage>,
  agentModel: ModelId
) {
  return new ToolLoopAgent({
    model: model.languageModel(agentModel),
    instructions: researchAgentConfig.instructions,
    tools: getToolsByCategory("research", writer),
    stopWhen: stepCountIs(researchAgentConfig.maxSteps),
  });
}

/**
 * Type for research agent instance
 */
export type ResearchAgent = ReturnType<typeof createResearchAgent>;

/**
 * Run research task convenience function
 * 
 * @param writer - UIMessageStreamWriter
 * @param agentModel - Model ID to use
 * @param task - Research task description
 * @param options - Optional abort signal
 */
export async function runResearch(
  writer: UIMessageStreamWriter<MyUIMessage>,
  agentModel: ModelId,
  task: string,
  options?: { abortSignal?: AbortSignal }
) {
  const agent = createResearchAgent(writer, agentModel);
  
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

**Update File**: `packages/ai/agents/index.ts`

```typescript
// Export schemas
export * from "./schema";

// Export registry
export * from "./registry";

// Export agents
export * from "./research";
```

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
