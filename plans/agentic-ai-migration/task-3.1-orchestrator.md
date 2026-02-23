# Task 3.1: Create Orchestrator Agent (CORRECTED)

## Goal
Create the main orchestrator agent that uses user's selected model dynamically and delegates to sub-agents

## Context
Orchestrator uses dynamic model from user selection (`selectedModel`), while sub-agents use a configurable model from `@repo/ai/config/vercel.ts`

## AI SDK References
- **Building Agents**: https://ai-sdk.dev/docs/agents/building-agents
- **Subagents**: https://ai-sdk.dev/docs/agents/subagents
- **ToolLoopAgent Constructor**: `node_modules/ai/dist/index.d.mts` (lines showing ToolLoopAgentSettings)

## Implementation

**File**: `packages/ai/agents/orchestrator.ts`

```typescript
import { 
  ToolLoopAgent, 
  tool, 
  stepCountIs,
  readUIMessageStream,
} from "ai";
import * as z from "zod";
import { model, type ModelId } from "@repo/ai/config/vercel";
import { orchestratorPrompt } from "@repo/ai/prompt/agents/orchestrator";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { DelegateInputSchema } from "./schema";
import { createResearchAgent } from "./research";
import { createContentAgent } from "./content";
import { createAnalysisAgent } from "./analysis";
import { createWebAgent } from "./web";
import { isMathematicalQuery } from "./analysis";
import { isExternalUrl, extractUrlFromQuery } from "./web";

/**
 * Maximum steps for orchestrator
 * Reference: https://ai-sdk.dev/docs/agents/building-agents#loop-control
 */
export const ORCHESTRATOR_MAX_STEPS = 15;

/**
 * Default sub-agent model - easily replaceable
 * Change this constant to use a different model for all sub-agents
 */
export const DEFAULT_SUB_AGENT_MODEL: ModelId = "claude-sonnet-4.5";

/**
 * Create orchestrator agent with dynamic model
 * 
 * The orchestrator uses the user's selected model for main reasoning,
 * while sub-agents use DEFAULT_SUB_AGENT_MODEL for specialized tasks.
 * 
 * @param writer - UIMessageStreamWriter for UI updates
 * @param selectedModel - Model ID selected by user (dynamic)
 * @param context - Context object with URL, page info, etc.
 * @returns Configured ToolLoopAgent
 * 
 * @example
 * ```typescript
 * const orchestrator = createOrchestratorAgent(
 *   writer,
 *   "kimi-k2.5",
 *   { url, currentPage, currentDate, userLocation }
 * );
 * ```
 */
export function createOrchestratorAgent(
  writer: UIMessageStreamWriter<MyUIMessage>,
  selectedModel: ModelId,
  context: {
    url: string;
    currentPage: { locale: string; slug: string; verified: boolean };
    currentDate: string;
    userLocation: { city: string; country: string };
    userRole?: string;
  }
) {
  return new ToolLoopAgent({
    // Use the user's selected model dynamically
    // Reference: https://ai-sdk.dev/docs/agents/building-agents#model-and-system-instructions
    model: model.languageModel(selectedModel),
    instructions: orchestratorPrompt(context),
    tools: {
      delegate: createDelegateTool(writer),
    },
    stopWhen: stepCountIs(ORCHESTRATOR_MAX_STEPS),
  });
}

/**
 * Type for orchestrator agent instance
 * Reference: https://ai-sdk.dev/docs/agents/building-agents#end-to-end-type-safety
 */
export type OrchestratorAgent = ReturnType<typeof createOrchestratorAgent>;

/**
 * Create delegation tool that spawns sub-agents
 * 
 * This tool uses async generators to stream sub-agent progress to the UI
 * while controlling what the parent model sees via toModelOutput.
 * 
 * Reference: https://ai-sdk.dev/docs/agents/subagents#streaming-subagent-progress
 */
function createDelegateTool(writer: UIMessageStreamWriter<MyUIMessage>) {
  return tool({
    description: `Delegate a task to a specialized sub-agent.

Available agents:
- research: Web search, finding subjects/articles
- content: Retrieving Nakafa content (requires verified slug)
- analysis: Mathematical calculations  
- web: Scraping external URLs`,
    
    inputSchema: DelegateInputSchema,
    
    outputSchema: z.string(),
    
    // Async generator for streaming preliminary results to UI
    // Reference: https://ai-sdk.dev/docs/agents/subagents#streaming-subagent-progress
    execute: async function* ({ agentType, task, context }, { abortSignal }) {
      // Create appropriate sub-agent with default model
      const agent = createSubAgent(agentType, writer);
      
      try {
        // Start sub-agent with streaming
        const result = await agent.stream({
          prompt: context ? `${task}\n\nContext: ${context}` : task,
          abortSignal,
        });
        
        // Stream progress to UI using readUIMessageStream
        // Reference: https://ai-sdk.dev/docs/agents/subagents#building-the-complete-message
        for await (const message of readUIMessageStream({
          stream: result.toUIMessageStream(),
        })) {
          yield JSON.stringify({
            status: "progress",
            agentType,
            message,
            timestamp: Date.now(),
          });
        }
        
        // Extract final result for return
        const response = await result.response;
        const lastText = response.messages
          .flatMap(m => m.parts || [])
          .filter(p => p.type === "text")
          .pop()?.text || "Task completed";
        
        return JSON.stringify({
          status: "completed",
          agentType,
          result: lastText,
        });
        
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return JSON.stringify({
          status: "error",
          agentType,
          error: message,
        });
      }
    },
    
    // Control what the orchestrator model sees
    // Reference: https://ai-sdk.dev/docs/agents/subagents#controlling-what-the-model-sees
    toModelOutput: ({ output }) => {
      try {
        const parsed = JSON.parse(output as string);
        
        if (parsed.status === "completed") {
          return {
            type: "text" as const,
            value: parsed.result,
          };
        }
        
        if (parsed.status === "error") {
          return {
            type: "text" as const,
            value: `Error from ${parsed.agentType} agent: ${parsed.error}`,
          };
        }
        
        return {
          type: "text" as const,
          value: `${parsed.agentType} agent is working...`,
        };
        
      } catch {
        return {
          type: "text" as const,
          value: output as string,
        };
      }
    },
  });
}

/**
 * Create sub-agent based on type
 * All sub-agents use DEFAULT_SUB_AGENT_MODEL for consistency
 */
function createSubAgent(
  agentType: "research" | "content" | "analysis" | "web",
  writer: UIMessageStreamWriter<MyUIMessage>
) {
  switch (agentType) {
    case "research":
      return createResearchAgent(writer, DEFAULT_SUB_AGENT_MODEL);
    case "content":
      return createContentAgent(writer, DEFAULT_SUB_AGENT_MODEL);
    case "analysis":
      return createAnalysisAgent(writer, DEFAULT_SUB_AGENT_MODEL);
    case "web":
      return createWebAgent(writer, DEFAULT_SUB_AGENT_MODEL);
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

/**
 * Quick routing helper to determine which agent to use
 * Returns null if no specific agent is needed (handle directly)
 */
export function routeToAgent(
  query: string,
  context?: { hasVerifiedSlug?: boolean }
): { agent: "research" | "content" | "analysis" | "web" | null; confidence: number } {
  // Check for math
  const mathConfidence = isMathematicalQuery(query);
  if (mathConfidence >= 0.5) {
    return { agent: "analysis", confidence: mathConfidence };
  }
  
  // Check for URL
  const url = extractUrlFromQuery(query);
  if (url && isExternalUrl(url)) {
    return { agent: "web", confidence: 0.9 };
  }
  
  // Check for verified slug
  if (context?.hasVerifiedSlug) {
    return { agent: "content", confidence: 0.8 };
  }
  
  // Check for research keywords
  const researchKeywords = /\b(search|find|look up|research|what is|how to|latest)\b/i;
  if (researchKeywords.test(query)) {
    return { agent: "research", confidence: 0.7 };
  }
  
  return { agent: null, confidence: 0 };
}
```

## Key Design Decisions

### Orchestrator Model: Dynamic
- Uses `selectedModel` parameter passed from chat route (line 59)
- User can choose any model from `@repo/ai/config/vercel.ts`
- This is the "main brain" that decides delegation

### Sub-agent Model: Configurable Constant
- Uses `DEFAULT_SUB_AGENT_MODEL` constant (line 32)
- Easy to change: just update the constant value
- All sub-agents use the same model for consistency

### Why This Pattern?
1. **Flexibility**: Users can choose their preferred model for main reasoning
2. **Simplicity**: Sub-agents use a sensible default that works well
3. **Cost Control**: Sub-agents can use cheaper models since they're specialized
4. **Easy Maintenance**: One constant to change updates all sub-agents

## AI SDK Best Practices Applied

1. **ToolLoopAgent**: Used for both orchestrator and sub-agents
   - Reference: https://ai-sdk.dev/docs/agents/building-agents#creating-an-agent

2. **Streaming with async generators**: `execute: async function*`
   - Reference: https://ai-sdk.dev/docs/agents/subagents#streaming-subagent-progress

3. **Context control with toModelOutput**: Limits what parent model sees
   - Reference: https://ai-sdk.dev/docs/agents/subagents#controlling-what-the-model-sees

4. **Abort signal propagation**: Passed through to sub-agents
   - Reference: https://ai-sdk.dev/docs/agents/subagents#handling-cancellation

5. **readUIMessageStream**: Accumulates streaming messages
   - Reference: https://ai-sdk.dev/docs/agents/subagents#building-the-complete-message

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```

## References

- AI SDK Building Agents: https://ai-sdk.dev/docs/agents/building-agents
- AI SDK Subagents: https://ai-sdk.dev/docs/agents/subagents
- AI SDK ToolLoopAgent Types: `node_modules/ai/dist/index.d.mts`
- Current Chat Route: `apps/www/app/api/chat/route.ts`
- Model Config: `packages/ai/config/vercel.ts`
