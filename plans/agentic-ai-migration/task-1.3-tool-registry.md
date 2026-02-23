# Task 1.3: Create Tool Registry

## Goal
Create a centralized tool registry with categorization for dynamic tool discovery, replacing flat tool exports.

## Context
Current tools are exported flat from `packages/ai/tools/index.ts`. We need categorized registry for agent-specific tool discovery.

## Architecture

### Tool Categories
Based on analysis of `packages/ai/tools/*.ts`:

| Category | Tools | Purpose |
|----------|-------|---------|
| **research** | webSearch, scrape | Web-based research and external content |
| **study** | getSubjects, getArticles, getContent | Nakafa's internal educational content |
| **math** | calculator | Mathematical calculations |

### Registry Structure

**File**: `packages/ai/agents/registry.ts`

```typescript
// Registry entry structure
interface RegistryEntry {
  name: string;
  description: string;  // From descriptions.ts
  category: ToolCategory;
  factory: ToolFactory; // (writer) => Tool
}

// Central registry
export const toolRegistry: Record<string, RegistryEntry>

// Helper functions
export function getToolsByCategory({ category, writer })
export function getAllTools({ writer })
export function getToolNamesByCategory(category)
export function getToolDescription(name)
export function getToolsDescription()
```

### Key Design Decisions

1. **Object Parameters**: All functions use object destructuring for better autocomplete
2. **Description Functions**: Import descriptions from `packages/ai/prompt/agents/descriptions.ts`
3. **No Barrel Files**: Import directly from specific files

## Import Pattern

**NO index.ts barrel file!**

```typescript
// ❌ WRONG
import { createOrchestratorAgent } from "@repo/ai/agents";

// ✅ CORRECT
import { createOrchestratorAgent } from "@repo/ai/agents/orchestrator";
import { toolRegistry } from "@repo/ai/agents/registry";
```

## References

- **Current Tools**: `packages/ai/tools/*.ts`
- **Tool Pattern**: See `packages/ai/tools/calculator.ts` for implementation pattern
- **AI SDK Tools**: https://ai-sdk.dev/docs/agents/building-agents#tools

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
