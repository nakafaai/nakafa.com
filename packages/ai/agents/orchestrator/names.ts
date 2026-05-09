import type { ToolName } from "@repo/ai/schema/tools";

/**
 * Tool names used by the orchestrator.
 */
export const TOOL_NAMES = {
  nakafa: "nakafa",
  deepResearch: "deepResearch",
  math: "math",
} satisfies Record<ToolName, ToolName>;
