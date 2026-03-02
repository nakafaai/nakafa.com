import { createContentAccessTool } from "@repo/ai/agents/orchestrator/content-access";
import { createMathTool } from "@repo/ai/agents/orchestrator/math";
import { createResearchTool } from "@repo/ai/agents/orchestrator/research";
import type { OrchestratorToolParams } from "@repo/ai/types/agents";

/**
 * Create orchestrator tools with usage tracking.
 * All sub-agents accumulate their token usage through the usageAccumulator.
 * Reference: AI SDK best practice for tracking sub-agent usage
 */
export function orchestratorTools({
  writer,
  modelId,
  locale,
  context,
  usageAccumulator,
}: OrchestratorToolParams) {
  return {
    contentAccess: createContentAccessTool({
      writer,
      modelId,
      locale,
      context,
      usageAccumulator,
    }),
    deepResearch: createResearchTool({
      writer,
      modelId,
      locale,
      context,
      usageAccumulator,
    }),
    mathCalculation: createMathTool({
      writer,
      modelId,
      locale,
      context,
      usageAccumulator,
    }),
  };
}
