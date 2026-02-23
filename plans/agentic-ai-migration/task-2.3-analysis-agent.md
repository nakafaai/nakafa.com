# Task 2.3: Create Analysis Agent

## Goal
Create the analysis sub-agent for mathematical calculations

## Context
Uses AI SDK's ToolLoopAgent with analysis category tools

## Implementation

**File**: `packages/ai/agents/analysis.ts`

```typescript
import { ToolLoopAgent, stepCountIs } from "ai";
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
 * @param writer - UIMessageStreamWriter for UI updates
 * @param agentModel - Model ID to use for this agent (from config/vercel.ts)
 * @returns Configured ToolLoopAgent
 */
export function createAnalysisAgent(
  writer: UIMessageStreamWriter<MyUIMessage>,
  agentModel: ModelId
) {
  return new ToolLoopAgent({
    model: model.languageModel(agentModel),
    instructions: analysisAgentConfig.instructions,
    tools: getToolsByCategory("analysis", writer),
    stopWhen: stepCountIs(analysisAgentConfig.maxSteps),
  });
}

/**
 * Type for analysis agent instance
 */
export type AnalysisAgent = ReturnType<typeof createAnalysisAgent>;

/**
 * Perform analysis convenience function
 * 
 * @param writer - UIMessageStreamWriter
 * @param agentModel - Model ID to use
 * @param task - Analysis task description
 * @param options - Optional abort signal
 */
export async function performAnalysis(
  writer: UIMessageStreamWriter<MyUIMessage>,
  agentModel: ModelId,
  task: string,
  options?: { abortSignal?: AbortSignal }
) {
  const agent = createAnalysisAgent(writer, agentModel);
  
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

**Update File**: `packages/ai/agents/index.ts`

```typescript
// Export schemas
export * from "./schema";

// Export registry
export * from "./registry";

// Export agents
export * from "./research";
export * from "./content";
export * from "./analysis";
```

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
