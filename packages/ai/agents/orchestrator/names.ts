import type { ToolName } from "@repo/ai/schema/tools";

/**
 * Tool names used by the orchestrator.
 */
export const TOOL_NAMES = {
  nakafa: "nakafa",
  deepResearch: "deepResearch",
  mathCalculation: "mathCalculation",
} satisfies Record<ToolName, ToolName>;
