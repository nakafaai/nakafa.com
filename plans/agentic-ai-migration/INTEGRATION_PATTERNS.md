# Agentic AI - Integration Patterns Guide

## Overview

This document explains how the agentic architecture integrates with your existing data parts pattern and AI SDK best practices.

**Key References:**
- AI SDK Building Agents: https://ai-sdk.dev/docs/agents/building-agents
- AI SDK Subagents: https://ai-sdk.dev/docs/agents/subagents
- Current Schema: `packages/backend/convex/chats/schema.ts` (lines 105-126, 219-263)

---

## Core Pattern: Tools + Data Parts

### How It Works

```
User Request → Agent → Tool Execution
                     │
                     ├─→ LLM sees: String output (toModelOutput)
                     │
                     └─→ UI sees: Structured data parts (via writer)
```

### The Rule

1. **To LLM**: Tools return **strings** via `toModelOutput`
2. **To UI**: Tools write **structured data parts** via `writer`
3. **Storage**: Data parts are persisted in Convex (schema lines 219-263)

---

## Data Parts Architecture

### Existing Data Part Types (schema.ts)

From `packages/backend/convex/chats/schema.ts`:

```typescript
// Tool parts (for UI display)
partTypeValidator = literals(
  "text",
  "reasoning", 
  "tool-getArticles",
  "tool-getSubjects",
  "tool-getContent",
  "tool-calculator",
  "tool-scrape",
  "tool-webSearch",
  // ...
);

// Data parts (for structured storage)
"data-suggestions",
"data-get-articles",
"data-get-subjects", 
"data-get-content",
"data-calculator",
"data-scrape-url",
"data-web-search"
```

### Data Part Schema Examples

**Calculator Data** (lines 247-251):
```typescript
dataCalculatorId: v.optional(v.string()),
dataCalculatorOriginal: v.optional(calculatorExpressionValidator),
dataCalculatorResult: v.optional(calculatorResultValidator),
dataCalculatorStatus: v.optional(literals("done", "error")),
dataCalculatorError: v.optional(v.string()),
```

**Web Search Data** (lines 259-263):
```typescript
dataWebSearchId: v.optional(v.string()),
dataWebSearchQuery: v.optional(v.string()),
dataWebSearchSources: v.optional(v.array(webSearchSourceValidator)),
dataWebSearchStatus: v.optional(dataStatusValidator),
dataWebSearchError: v.optional(v.string()),
```

---

## Tool Implementation Pattern

### Current Tool Pattern (from tools/*.ts)

Tools follow this structure:

```typescript
export function createMyTool({ writer }: { writer: UIMessageStreamWriter }) {
  return tool({
    description: "Tool description",
    inputSchema: MyInputSchema,
    
    // Async generator for streaming
    execute: async function* ({ input }) {
      // 1. Yield loading state to UI
      writer.write({
        id: dataPartId,
        type: "data-my-tool",
        data: { status: "loading" }
      });
      
      // 2. Do the work
      const result = await doWork(input);
      
      // 3. Write final data to UI
      writer.write({
        id: dataPartId,
        type: "data-my-tool", 
        data: {
          status: "done",
          result: result
        }
      });
      
      // 4. Return string to LLM
      return "Work completed successfully";
    },
    
    // Control what model sees
    toModelOutput: ({ output }) => ({
      type: "text",
      value: output // String for LLM
    })
  });
}
```

### Key Points

1. **writer.write()** - Sends data parts to UI (structured)
2. **return** - Sends string to LLM
3. **toModelOutput** - Controls token representation
4. **Async generator** - Allows streaming updates

---

## Subagent Pattern

### Basic Subagent (No Streaming)

From AI SDK docs:

```typescript
const researchSubagent = new ToolLoopAgent({
  model: model,
  instructions: "Research and summarize findings",
  tools: { webSearch, getSubjects },
});

const researchTool = tool({
  description: "Research a topic",
  inputSchema: z.object({ task: z.string() }),
  
  execute: async ({ task }, { abortSignal }) => {
    const result = await researchSubagent.generate({
      prompt: task,
      abortSignal,
    });
    return result.text; // String to parent agent
  },
});
```

### Streaming Subagent (With UI Progress)

From AI SDK docs - using preliminary results:

```typescript
const researchTool = tool({
  description: "Research with progress updates",
  inputSchema: z.object({ task: z.string() }),
  
  // Async generator for streaming
  execute: async function* ({ task }, { abortSignal }) {
    const result = await researchSubagent.stream({
      prompt: task,
      abortSignal,
    });
    
    // Stream each chunk to UI
    for await (const message of readUIMessageStream({
      stream: result.toUIMessageStream(),
    })) {
      yield message; // Preliminary result to UI
    }
  },
  
  // Control what parent agent sees
  toModelOutput: ({ output: message }) => {
    const lastText = message?.parts.findLast(p => p.type === "text");
    return {
      type: "text",
      value: lastText?.text ?? "Completed"
    };
  }
});
```

### Critical: Context Management

**Without toModelOutput:**
- Parent sees: Full subagent conversation (100k tokens)
- Problem: Context bloat, expensive, incoherent

**With toModelOutput:**
- Parent sees: Just the summary (1k tokens)
- Benefit: Clean context, focused, cost-effective

---

## Agent Hierarchy

### Architecture

```
Orchestrator Agent (claude-opus-4-6)
├── delegate tool
    ├── Research Subagent (claude-sonnet-4-5)
    │   ├── webSearch tool → data-web-search parts
    │   ├── getSubjects tool → data-get-subjects parts
    │   └── getArticles tool → data-get-articles parts
    │
    ├── Content Subagent (claude-sonnet-4-5)  
    │   └── getContent tool → data-get-content parts
    │
    ├── Analysis Subagent (claude-sonnet-4-5)
    │   └── calculator tool → data-calculator parts
    │
    └── Web Subagent (claude-sonnet-4-5)
        └── scrape tool → data-scrape-url parts
```

### Token Flow

```
User: "Research quantum computing"

Orchestrator:
  ├─→ Calls delegate({ agentType: "research", task: "..." })
  │
  Research Agent:
  │   ├─→ webSearch (uses 50k tokens exploring)
  │   ├─→ getSubjects (uses 10k tokens)
  │   └─→ Synthesizes findings (5k tokens)
  │
  ├─→ toModelOutput extracts: "Summary of findings..." (1k tokens)
  ├─→ UI sees: Full tool calls and data parts
  └─→ Orchestrator uses summary for response
```

**Result**: 100k tokens of exploration → 1k token summary for main agent

---

## UI Rendering Pattern

### Tool States (from AI SDK docs)

| State | Description |
|-------|-------------|
| `input-streaming` | Tool input being generated |
| `input-available` | Tool ready to execute |
| `output-available` | Tool produced output (check `preliminary`) |
| `output-error` | Tool execution failed |

### Detecting Streaming vs Complete

```tsx
const hasOutput = part.state === "output-available";
const isStreaming = hasOutput && part.preliminary === true;
const isComplete = hasOutput && !part.preliminary;
```

### Type Safety

```typescript
import { InferAgentUIMessage } from "ai";

const mainAgent = new ToolLoopAgent({
  // ... config with researchTool
});

// Export type for UI
export type MainAgentMessage = InferAgentUIMessage<typeof mainAgent>;
```

---

## Migration Checklist

### Phase 1: Foundation
- [ ] Schemas use Zod (validated at runtime)
- [ ] Prompts use `createPrompt` utility
- [ ] Tool registry categorizes by purpose

### Phase 2: Sub-Agents
- [ ] Each sub-agent has proper instructions
- [ ] Tools write data parts via writer
- [ ] Tools return strings to LLM

### Phase 3: Orchestrator
- [ ] Delegation tool uses async generator
- [ ] `toModelOutput` extracts summary only
- [ ] Proper abort signal propagation

### Phase 4: Integration
- [ ] Chat route creates orchestrator with context
- [ ] Message persistence unchanged (Convex)
- [ ] Suggestions generation still works
- [ ] UI renders data parts correctly

### Phase 5: Testing
- [ ] Sub-agents tested independently
- [ ] Orchestrator delegation tested
- [ ] End-to-end chat flow tested
- [ ] Data parts stored correctly

---

## Common Pitfalls

### ❌ Wrong: Returning structured data to LLM
```typescript
return { result: "data" }; // LLM sees [object Object]
```

### ✅ Right: Return string, write data parts
```typescript
writer.write({ type: "data-tool", data: result }); // UI sees structured
return "Task completed"; // LLM sees string
```

### ❌ Wrong: No toModelOutput
```typescript
tool({
  execute: async () => {
    return longResult; // LLM sees everything
  }
  // Missing toModelOutput
});
```

### ✅ Right: Control model context
```typescript
tool({
  execute: async function* () {
    yield preliminary;
    return final;
  },
  toModelOutput: ({ output }) => ({
    type: "text",
    value: extractSummary(output) // Only summary
  })
});
```

### ❌ Wrong: Blocking without streaming
```typescript
execute: async ({ task }) => {
  const result = await subagent.generate({ prompt: task });
  return result.text; // User sees nothing until done
}
```

### ✅ Right: Stream progress
```typescript
execute: async function* ({ task }) {
  const result = await subagent.stream({ prompt: task });
  for await (const msg of readUIMessageStream({ stream: result })) {
    yield msg; // User sees progress
  }
}
```

---

## References

### AI SDK Documentation
- Building Agents: https://ai-sdk.dev/docs/agents/building-agents
- Subagents: https://ai-sdk.dev/docs/agents/subagents
- Workflows: https://ai-sdk.dev/docs/agents/workflows

### Current Codebase
- Chat Schema: `packages/backend/convex/chats/schema.ts`
- Prompt Utils: `packages/ai/prompt/utils.ts`
- Existing Tools: `packages/ai/tools/*.ts`
- Chat Route: `apps/www/app/api/chat/route.ts`

---

## Summary

**The Pattern:**
1. **Tools** write data parts (structured) → UI displays them
2. **Tools** return strings → LLM reasons with them
3. **toModelOutput** controls what model sees vs what's stored
4. **Subagents** use async generators for streaming
5. **Orchestrator** delegates and synthesizes

**The Goal:** Clean context, efficient tokens, rich UI, scalable architecture.
