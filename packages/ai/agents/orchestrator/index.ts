import { createContentAccessTool } from "@repo/ai/agents/orchestrator/content-access";
import { createMathTool } from "@repo/ai/agents/orchestrator/math";
import { createResearchTool } from "@repo/ai/agents/orchestrator/research";
import type { OrchestratorToolParams } from "@repo/ai/types/agents";

/**
 * Tool names used by the orchestrator.
 * Single source of truth for tool identifiers.
 */
export const TOOL_NAMES = {
  contentAccess: "contentAccess",
  deepResearch: "deepResearch",
  mathCalculation: "mathCalculation",
} as const;

/**
 * Tool name type - inferred from TOOL_NAMES.
 */
export type ToolName = keyof typeof TOOL_NAMES;

/**
 * Create orchestrator tools with usage tracking.
 * All sub-agents accumulate their token usage through the usageAccumulator.
 */
export function orchestratorTools({
  writer,
  modelId,
  locale,
  context,
  usageAccumulator,
}: OrchestratorToolParams) {
  return {
    [TOOL_NAMES.contentAccess]: createContentAccessTool({
      writer,
      modelId,
      locale,
      context,
      usageAccumulator,
    }),
    [TOOL_NAMES.deepResearch]: createResearchTool({
      writer,
      modelId,
      locale,
      context,
      usageAccumulator,
    }),
    [TOOL_NAMES.mathCalculation]: createMathTool({
      writer,
      modelId,
      locale,
      context,
      usageAccumulator,
    }),
  };
}
