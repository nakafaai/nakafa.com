# Agentic AI Migration - Verification Report

## Executive Summary

All plans have been verified against:
- **AI SDK v6.0.97 Documentation**: https://ai-sdk.dev/docs/agents/building-agents
- **AI SDK Subagents**: https://ai-sdk.dev/docs/agents/subagents  
- **Your Requirements**: No re-exports, no hardcoding, direct imports only

**Status**: ✅ All critical issues identified and corrected

---

## Issues Found & Corrections

### 1. ❌ RE-EXPORTS (Critical Violation)

**Problem**: Multiple files use `export * from "./module"` pattern

**Files Affected**:
- `task-2.1-research-agent.md` line 92-103 (removed index.ts reference)
- `task-2.2-content-agent.md` line 79-88 (removed index.ts reference)
- `task-2.3-analysis-agent.md` line 89-99 (removed index.ts reference)
- `task-2.4-web-agent.md` line 103-113 (removed index.ts reference)
- `task-3.1-orchestrator.md` line 229-244 (removed index.ts reference)

**Correction**: NO barrel files (index.ts) at all! Use direct imports from specific files.

```typescript
// ❌ WRONG - Barrel file with re-exports
// packages/ai/agents/index.ts
export * from "./schema";
export * from "./registry";
export { createResearchAgent } from "./research";

// ❌ WRONG - Importing from barrel
import { createOrchestratorAgent } from "@repo/ai/agents";

// ✅ CORRECT - Direct imports only (NO index.ts)
import { createOrchestratorAgent } from "@repo/ai/agents/orchestrator";
import { DelegateInputSchema } from "@repo/ai/agents/schema";
import { toolRegistry } from "@repo/ai/agents/registry";
```

---

### 2. ❌ IMPORT CONSOLIDATION

**Problem**: Multiple separate imports from same module

**Example from task-3.1-orchestrator.md**:
```typescript
// ❌ WRONG - Separate imports
import { ToolLoopAgent, tool, stepCountIs, readUIMessageStream } from "ai";
import type { UIMessageStreamWriter } from "ai";

// ✅ CORRECT - Consolidated
import {
  ToolLoopAgent,
  tool,
  stepCountIs,
  readUIMessageStream,
  type UIMessageStreamWriter,
} from "ai";
```

---

### 3. ❌ DEAD CODE

**Problem**: Unused exports and redundant functions

**Files with dead code**:
- `task-2.1-research-agent.md`: `ResearchAgent` type export (line 61) - not used externally
- `task-2.2-content-agent.md`: `ContentAgent` type export (line 48) - not used externally
- `task-2.3-analysis-agent.md`: `AnalysisAgent` type export (line 51) - not used externally
- `task-2.4-web-agent.md`: `WebAgent` type export (line 47) - not used externally

**Correction**: Remove unused type exports, only export what's needed

---

### 4. ✅ HARDCODING - FIXED

**Issue Found**: `task-1.1-agent-schemas.md` line 39 had hardcoded default model

**Correction**: Removed `model` field from AgentConfigSchema entirely

**Why**: Model is determined at runtime, not in config:
- Orchestrator uses dynamic `selectedModel` parameter from user
- Sub-agents use SAME `selectedModel` as orchestrator (passed via parameter)
- All agents use the user's selected model consistently

**Before**:
```typescript
model: z.string().default("claude-sonnet-4-5")
```

**After**: Removed from schema - model passed as parameter instead

---

### 5. ✅ AI SDK BEST PRACTICES - VERIFIED

All plans follow AI SDK best practices with proper documentation:

#### 5.1 ToolLoopAgent Usage
**Reference**: https://ai-sdk.dev/docs/agents/building-agents#creating-an-agent

✅ **Correct Implementation**:
```typescript
const agent = new ToolLoopAgent({
  model: model.languageModel(agentModel),
  instructions: agentPrompt,
  tools: toolSet,
  stopWhen: stepCountIs(maxSteps),
});
```

#### 5.2 Subagent Streaming
**Reference**: https://ai-sdk.dev/docs/agents/subagents#streaming-subagent-progress

✅ **Correct Implementation**:
```typescript
execute: async function* ({ task }, { abortSignal }) {
  const result = await subagent.stream({ prompt: task, abortSignal });
  
  for await (const message of readUIMessageStream({
    stream: result.toUIMessageStream(),
  })) {
    yield message;
  }
}
```

#### 5.3 Context Control with toModelOutput
**Reference**: https://ai-sdk.dev/docs/agents/subagents#controlling-what-the-model-sees

✅ **Correct Implementation**:
```typescript
toModelOutput: ({ output }) => {
  const parsed = JSON.parse(output as string);
  if (parsed.status === "completed") {
    return {
      type: "text",
      value: parsed.result, // Only summary to parent
    };
  }
}
```

#### 5.4 Abort Signal Propagation
**Reference**: https://ai-sdk.dev/docs/agents/subagents#handling-cancellation

✅ **Correct Implementation**:
```typescript
execute: async ({ task }, { abortSignal }) => {
  const result = await subagent.generate({
    prompt: task,
    abortSignal, // Properly propagated
  });
  return result.text;
}
```

---

## Corrected Architecture

### Import Pattern (Direct Imports Only - NO index.ts)

**NO barrel files!** Import directly from specific files:

```typescript
// ❌ WRONG - Barrel/index.ts import
import { createOrchestratorAgent, toolRegistry } from "@repo/ai/agents";

// ✅ CORRECT - Direct imports only
import { createOrchestratorAgent } from "@repo/ai/agents/orchestrator";
import { DelegateInputSchema } from "@repo/ai/agents/schema";
import { toolRegistry, getToolsByCategory } from "@repo/ai/agents/registry";
import { createResearchAgent } from "@repo/ai/agents/research";
import { createContentAgent } from "@repo/ai/agents/content";
import { createAnalysisAgent } from "@repo/ai/agents/analysis";
import { createWebAgent } from "@repo/ai/agents/web";
```

### Model Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  USER SELECTS MODEL (e.g., "kimi-k2.5")                     │
│  Reference: route.ts line 73                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR AGENT                                         │
│  - Uses: selectedModel (dynamic)                           │
│  - Function: createOrchestratorAgent(writer, selectedModel) │
│  - Reference: task-3.1-orchestrator.md line 59-68          │
└──────────┬──────────────────────────────────────────────────┘
           │
           │ delegates via "delegate" tool
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│  SUB-AGENTS (All use SAME model as orchestrator)           │
│  - Model: selectedModel (same as orchestrator)             │
│  - Passed through createSubAgent function                  │
│  - Reference: task-3.1-orchestrator.md line 203-220        │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Foundation ✅
- [x] **Task 1.1**: Zod schemas with proper types
- [x] **Task 1.2**: Prompt utilities using `createPrompt`
- [x] **Task 1.3**: Tool registry with explicit exports (FIXED)

### Phase 2: Sub-Agents ✅
- [x] **Task 2.1**: Research agent with ModelId parameter
- [x] **Task 2.2**: Content agent with ModelId parameter
- [x] **Task 2.3**: Analysis agent with ModelId parameter
- [x] **Task 2.4**: Web agent with ModelId parameter

### Phase 3: Orchestrator ✅
- [x] **Task 3.1**: Orchestrator with dynamic model (FIXED)
  - Dynamic model from user selection
  - Sub-agents use SAME model as orchestrator (passed via parameter)
  - Proper streaming with async generators
  - Context control with toModelOutput
  - Fixed: createDelegateTool now passes selectedModel to createSubAgent

### Phase 4: Integration ✅
- [x] **Task 4.1**: Chat route integration
  - Passes selectedModel to orchestrator
  - Maintains all existing functionality

### Phase 5: Testing ⏳
- [ ] **Task 5.1**: Unit tests for agents

---

## References & Documentation

### AI SDK Documentation
1. **Building Agents**: https://ai-sdk.dev/docs/agents/building-agents
   - ToolLoopAgent constructor options
   - Loop control with stepCountIs
   - Lifecycle callbacks

2. **Subagents**: https://ai-sdk.dev/docs/agents/subagents
   - Streaming subagent progress
   - readUIMessageStream usage
   - toModelOutput for context control
   - Abort signal propagation

3. **ToolLoopAgent Types**: `node_modules/ai/dist/index.d.mts`
   - Constructor signatures verified
   - Type exports confirmed

### Your Codebase
1. **Chat Route**: `apps/www/app/api/chat/route.ts` (line 73: selectedModel)
2. **Model Config**: `packages/ai/config/vercel.ts` (ModelId type)
3. **Prompt Utils**: `packages/ai/prompt/utils.ts` (createPrompt function)
4. **Chat Schema**: `packages/backend/convex/chats/schema.ts` (data parts pattern)

---

## Summary of Corrections Made

### Fixed in task-3.1-orchestrator.md
1. ✅ Consolidated imports from "ai"
2. ✅ Moved zod import to top (convention)
3. ✅ Replaced agentFactories object with createSubAgent function
4. ✅ Added proper JSDoc comments with AI SDK references
5. ✅ Removed dead code (unused agent type exports)
6. ✅ Fixed toModelOutput to use proper type assertions
7. ✅ Added explicit return types
8. ✅ **CRITICAL FIX**: createDelegateTool now receives and passes `selectedModel` to createSubAgent
9. ✅ **CRITICAL FIX**: All agents now use SAME model (user's selection)

### Pattern Applied Across All Files
1. ✅ NO barrel files (index.ts) - direct imports only
2. ✅ NO re-exports (export *) - explicit named exports only
3. ✅ Direct imports from specific files (e.g., `@repo/ai/agents/orchestrator`)
4. ✅ Object parameters for all functions - better autocomplete in editor
5. ✅ No hardcoded values - use constants and parameters
6. ✅ All AI SDK patterns verified against documentation
7. ✅ Proper streaming with async generators
8. ✅ Context control with toModelOutput
9. ✅ Abort signal propagation

---

## Next Steps

1. ✅ **Plans verified** - All issues identified and corrected
2. ⏳ **Implement Task 1.1-1.3** (Foundation)
3. ⏳ **Implement Task 2.1-2.4** (Sub-agents)
4. ⏳ **Implement Task 3.1** (Orchestrator - use corrected version)
5. ⏳ **Implement Task 4.1** (Integration)
6. ⏳ **Run verification commands** after each phase:
   ```bash
   pnpm lint
   pnpm --filter @repo/ai typecheck
   pnpm test
   ```

---

**All plans are now verified and corrected according to AI SDK best practices and your requirements.**
