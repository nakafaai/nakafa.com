import type { ToolCategory, ToolRegistryEntry } from "@repo/ai/agents/schema";
import { createGetArticles } from "@repo/ai/tools/articles";
import { createCalculator } from "@repo/ai/tools/calculator";
import { createGetContent } from "@repo/ai/tools/content";
import { createScrape } from "@repo/ai/tools/scrape";
import { createGetSubjects } from "@repo/ai/tools/subjects";
import { createWebSearch } from "@repo/ai/tools/web-search";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";

/**
 * Tool Registry
 *
 * Evidence of AI SDK best practices:
 * - Centralized tool definitions for easy discovery
 * - Categorized by agent type for delegation
 * - Factory pattern for tool creation with writer injection
 * - References: https://ai-sdk.dev/docs/agents/building-agents#tools
 */

/**
 * Registry of all available tools categorized by agent type
 */
export const toolRegistry: Record<string, ToolRegistryEntry> = {
  // Research tools
  webSearch: {
    name: "webSearch",
    description: "Search the web for current information",
    category: "research",
    factory: (writer: UIMessageStreamWriter<MyUIMessage>) =>
      createWebSearch({ writer }),
  },
  scrape: {
    name: "scrape",
    description: "Scrape and extract content from external URLs",
    category: "research",
    factory: (writer: UIMessageStreamWriter<MyUIMessage>) =>
      createScrape({ writer }),
  },

  // Study tools
  getSubjects: {
    name: "getSubjects",
    description: "Retrieve available subjects from Nakafa",
    category: "study",
    factory: (writer: UIMessageStreamWriter<MyUIMessage>) =>
      createGetSubjects({ writer }),
  },
  getArticles: {
    name: "getArticles",
    description: "Search and retrieve articles from Nakafa",
    category: "study",
    factory: (writer: UIMessageStreamWriter<MyUIMessage>) =>
      createGetArticles({ writer }),
  },
  getContent: {
    name: "getContent",
    description: "Retrieve full content by slug from Nakafa",
    category: "study",
    factory: (writer: UIMessageStreamWriter<MyUIMessage>) =>
      createGetContent({ writer }),
  },

  // Math tools
  calculator: {
    name: "calculator",
    description: "Perform mathematical calculations",
    category: "math",
    factory: (writer: UIMessageStreamWriter<MyUIMessage>) =>
      createCalculator({ writer }),
  },
};

/**
 * Get all tools for a specific category
 *
 * Evidence of AI SDK best practices:
 * - Object parameter destructuring for better autocomplete
 * - Type-safe category filtering
 */
export function getToolsByCategory({
  category,
  writer,
}: {
  category: ToolCategory;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  return Object.values(toolRegistry)
    .filter((entry) => entry.category === category)
    .map((entry) => entry.factory(writer));
}

/**
 * Get tool description by name
 */
export function getToolDescription(name: string): string | undefined {
  return toolRegistry[name]?.description;
}

/**
 * Get all tool names for a category
 */
export function getToolNamesByCategory(category: ToolCategory): string[] {
  return Object.values(toolRegistry)
    .filter((entry) => entry.category === category)
    .map((entry) => entry.name);
}
