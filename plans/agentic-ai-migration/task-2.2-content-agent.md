# Task 2.2: Create Content Agent

## Goal
Create the content sub-agent for retrieving Nakafa educational materials

## Context
Uses AI SDK's ToolLoopAgent with content category tools. Uses the same model as orchestrator (user's selection).

## Implementation

**File**: `packages/ai/agents/content.ts`

```typescript
import { ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from "ai";
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
 * @param selectedModel - Model ID selected by user (same as orchestrator)
 * @returns Configured ToolLoopAgent
 */
export function createContentAgent(
  writer: UIMessageStreamWriter<MyUIMessage>,
  selectedModel: ModelId
) {
  return new ToolLoopAgent({
    // Uses the same model as orchestrator (user's selection)
    model: model.languageModel(selectedModel),
    instructions: contentAgentConfig.instructions,
    tools: getToolsByCategory("content", writer),
    stopWhen: stepCountIs(contentAgentConfig.maxSteps),
  });
}

/**
 * Type for content agent messages
 * Used in UI for type-safe message rendering
 */
export type ContentAgentMessage = InferAgentUIMessage<
  ReturnType<typeof createContentAgent>
>;

/**
 * Retrieve content convenience function
 * 
 * @param writer - UIMessageStreamWriter
 * @param selectedModel - Model ID selected by user
 * @param slug - Verified content slug
 * @param options - Optional context and abort signal
 */
export async function retrieveContent(
  writer: UIMessageStreamWriter<MyUIMessage>,
  selectedModel: ModelId,
  slug: string,
  options?: { context?: string; abortSignal?: AbortSignal }
) {
  const agent = createContentAgent(writer, selectedModel);
  
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

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
