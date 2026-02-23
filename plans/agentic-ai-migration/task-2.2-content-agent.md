# Task 2.2: Create Content Agent

## Goal
Create the content sub-agent for retrieving Nakafa educational materials

## Context
Uses AI SDK's ToolLoopAgent with content category tools

## Implementation

**File**: `packages/ai/agents/content.ts`

```typescript
import { ToolLoopAgent, stepCountIs } from "ai";
import { model, type ModelId } from "@repo/ai/config/vercel";
import { contentAgentPrompt } from "@repo/ai/prompt/agents/content";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { AgentConfigSchema } from "./schema";
import { getToolsByCategory } from "./registry";

/**
 * Content agent configuration
 */
export const contentAgentConfig = AgentConfigSchema.parse({
  id: "content",
  name: "Content Agent",
  description: "Specialized agent for retrieving Nakafa educational content",
  instructions: contentAgentPrompt(),
  maxSteps: 5,
});

/**
 * Create content agent instance
 * 
 * @param writer - UIMessageStreamWriter for UI updates
 * @param agentModel - Model ID to use for this agent (from config/vercel.ts)
 * @returns Configured ToolLoopAgent
 */
export function createContentAgent(
  writer: UIMessageStreamWriter<MyUIMessage>,
  agentModel: ModelId
) {
  return new ToolLoopAgent({
    model: model.languageModel(agentModel),
    instructions: contentAgentConfig.instructions,
    tools: getToolsByCategory("content", writer),
    stopWhen: stepCountIs(contentAgentConfig.maxSteps),
  });
}

/**
 * Type for content agent instance
 */
export type ContentAgent = ReturnType<typeof createContentAgent>;

/**
 * Retrieve content convenience function
 * 
 * @param writer - UIMessageStreamWriter
 * @param agentModel - Model ID to use
 * @param slug - Verified content slug
 * @param options - Optional context and abort signal
 */
export async function retrieveContent(
  writer: UIMessageStreamWriter<MyUIMessage>,
  agentModel: ModelId,
  slug: string,
  options?: { context?: string; abortSignal?: AbortSignal }
) {
  const agent = createContentAgent(writer, agentModel);
  
  const prompt = options?.context
    ? `Retrieve content for slug: ${slug}\n\nContext: ${options.context}`
    : `Retrieve content for slug: ${slug}`;
  
  const result = await agent.generate({
    prompt,
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
export * from "./content";
```

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
