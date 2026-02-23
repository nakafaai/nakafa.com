# Task 2.3: Create Analysis Agent

## Goal
Create the analysis sub-agent for mathematical calculations

## Context
Uses AI SDK's ToolLoopAgent with analysis category tools. Uses the same model as orchestrator (user's selection).

## Implementation

**File**: `packages/ai/agents/analysis.ts`

```typescript
import { ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from "ai";
import { model, type ModelId } from "@repo/ai/config/vercel";
import { analysisAgentPrompt } from "@repo/ai/prompt/agents/analysis";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { AgentConfigSchema } from "./schema";
import { getToolsByCategory } from "./registry";

/**
 * Analysis agent configuration
 */
export const analysisAgentConfig = AgentConfigSchema.parse({
  id: "analysis",
  name: "Analysis Agent",
  description: "Specialized agent for mathematical calculations and data analysis",
  instructions: analysisAgentPrompt(),
  maxSteps: 8,
});

/**
 * Create analysis agent instance
 * 
 * @param props - Configuration object
 * @param props.writer - UIMessageStreamWriter for UI updates
 * @param props.selectedModel - Model ID selected by user (same as orchestrator)
 * @returns Configured ToolLoopAgent
 */
export function createAnalysisAgent({
  writer,
  selectedModel,
}: {
  writer: UIMessageStreamWriter<MyUIMessage>;
  selectedModel: ModelId;
}) {
  return new ToolLoopAgent({
    // Uses the same model as orchestrator (user's selection)
    model: model.languageModel(selectedModel),
    instructions: analysisAgentConfig.instructions,
    tools: getToolsByCategory({ category: "analysis", writer }),
    stopWhen: stepCountIs(analysisAgentConfig.maxSteps),
  });
}

/**
 * Type for analysis agent messages
 * Used in UI for type-safe message rendering
 */
export type AnalysisAgentMessage = InferAgentUIMessage<
  ReturnType<typeof createAnalysisAgent>
>;

/**
 * Perform analysis convenience function
 * 
 * @param props - Configuration object
 * @param props.writer - UIMessageStreamWriter
 * @param props.selectedModel - Model ID selected by user
 * @param props.task - Analysis task description
 * @param props.abortSignal - Optional abort signal
 */
export async function performAnalysis({
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
  const agent = createAnalysisAgent({ writer, selectedModel });
  
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

/**
 * Regex patterns for detecting mathematical queries
 */
export const mathPatterns = {
  arithmetic: /[\d\s]+[\+\-\*\/\×\÷\^][\d\s]+/,
  equation: /[=\>\<]+.*\d/,
  percentage: /\d+%|\bpercent\b/i,
  keywords: /\b(calculate|compute|solve|equation|formula|sum|product|average|mean|median)\b/i,
  units: /\b(meters?|kilometers?|grams?|kg|liters?|seconds?|minutes?|hours?)\b/i,
};

/**
 * Check if a query is mathematical
 * Returns confidence score 0-1
 */
export function isMathematicalQuery(query: string): number {
  let score = 0;
  let matches = 0;
  
  for (const [name, pattern] of Object.entries(mathPatterns)) {
    if (pattern.test(query)) {
      matches++;
      if (name === "keywords") score += 0.4;
      else if (name === "arithmetic") score += 0.3;
      else score += 0.2;
    }
  }
  
  if (matches >= 2) score += 0.2;
  if (matches >= 3) score += 0.1;
  
  return Math.min(score, 1);
}

/**
 * Determine if query should use analysis agent
 */
export function shouldUseAnalysisAgent(query: string): boolean {
  return isMathematicalQuery(query) >= 0.5;
}
```

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
