# Task 1.3: Create Tool Registry

## Goal
Create a centralized tool registry with categorization for dynamic tool discovery

## Context
Replaces flat tool structure with categorized registry in agents directory. Direct imports only - no barrel files.

## Implementation

**File**: `packages/ai/agents/registry.ts`

```typescript
import { createGetArticles } from "@repo/ai/tools/articles";
import { createCalculator } from "@repo/ai/tools/calculator";
import { createGetContent } from "@repo/ai/tools/content";
import { createScrape } from "@repo/ai/tools/scrape";
import { createGetSubjects } from "@repo/ai/tools/subjects";
import { createWebSearch } from "@repo/ai/tools/web-search";
import type { Tool } from "ai";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { ToolCategorySchema, type ToolCategory } from "./schema";

/**
 * Tool factory type
 */
type ToolFactory = (writer: UIMessageStreamWriter<MyUIMessage>) => Tool;

/**
 * Tool registry entry
 */
interface RegistryEntry {
  name: string;
  description: string;
  category: ToolCategory;
  factory: ToolFactory;
}

/**
 * Central tool registry
 */
export const toolRegistry: Record<string, RegistryEntry> = {
  // Research tools
  webSearch: {
    name: "webSearch",
    description: "Search the web for up-to-date information",
    category: ToolCategorySchema.enum.research,
    factory: createWebSearch,
  },
  getSubjects: {
    name: "getSubjects",
    description: "Get educational subjects from Nakafa platform",
    category: ToolCategorySchema.enum.research,
    factory: createGetSubjects,
  },
  getArticles: {
    name: "getArticles",
    description: "Get articles from Nakafa platform",
    category: ToolCategorySchema.enum.research,
    factory: createGetArticles,
  },
  
  // Content tools
  getContent: {
    name: "getContent",
    description: "Get specific content from Nakafa platform (requires verified slug)",
    category: ToolCategorySchema.enum.content,
    factory: createGetContent,
  },
  
  // Analysis tools
  calculator: {
    name: "calculator",
    description: "Perform mathematical calculations using Math.js",
    category: ToolCategorySchema.enum.analysis,
    factory: createCalculator,
  },
  
  // Web tools
  scrape: {
    name: "scrape",
    description: "Scrape content from external URLs",
    category: ToolCategorySchema.enum.web,
    factory: createScrape,
  },
};

/**
 * Get tools by category
 */
export function getToolsByCategory({
  category,
  writer,
}: {
  category: ToolCategory;
  writer: UIMessageStreamWriter<MyUIMessage>;
}): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const [key, entry] of Object.entries(toolRegistry)) {
    if (entry.category === category) {
      tools[key] = entry.factory(writer);
    }
  }

  return tools;
}

/**
 * Get all tools
 */
export function getAllTools({
  writer,
}: {
  writer: UIMessageStreamWriter<MyUIMessage>;
}): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const [key, entry] of Object.entries(toolRegistry)) {
    tools[key] = entry.factory(writer);
  }

  return tools;
}

/**
 * Get tool names by category
 */
export function getToolNamesByCategory(category: ToolCategory): string[] {
  return Object.entries(toolRegistry)
    .filter(([, entry]) => entry.category === category)
    .map(([name]) => name);
}

/**
 * Get tool description for agent prompting
 */
export function getToolDescription(name: string): string | undefined {
  return toolRegistry[name]?.description;
}

/**
 * Get all tool descriptions formatted
 */
export function getToolsDescription(): string {
  const categories = [
    ToolCategorySchema.enum.research,
    ToolCategorySchema.enum.content,
    ToolCategorySchema.enum.analysis,
    ToolCategorySchema.enum.web,
  ];
  
  let description = "## Available Tools\n\n";
  
  for (const category of categories) {
    const tools = Object.entries(toolRegistry).filter(
      ([, entry]) => entry.category === category
    );
    
    if (tools.length > 0) {
      description += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
      for (const [name, entry] of tools) {
        description += `- ${name}: ${entry.description}\n`;
      }
      description += "\n";
    }
  }
  
  return description;
}
```

## Import Pattern

**NO index.ts barrel file!** Import directly from specific files:

```typescript
// ❌ WRONG - Barrel import
import { createOrchestratorAgent } from "@repo/ai/agents";

// ✅ CORRECT - Direct import
import { createOrchestratorAgent } from "@repo/ai/agents/orchestrator";
import { DelegateInputSchema } from "@repo/ai/agents/schema";
import { toolRegistry } from "@repo/ai/agents/registry";
```

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
