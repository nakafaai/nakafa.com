import { createContentAccessTool } from "@repo/ai/agents/orchestrator/content-access";
import { createMathTool } from "@repo/ai/agents/orchestrator/math";
import { createResearchTool } from "@repo/ai/agents/orchestrator/research";
import type { OrchestratorToolParams } from "@repo/ai/types/agents";

export function orchestratorTools({
  writer,
  modelId,
  locale,
  context,
}: OrchestratorToolParams) {
  return {
    contentAccess: createContentAccessTool({
      writer,
      modelId,
      locale,
      context,
    }),
    deepResearch: createResearchTool({ writer, modelId, locale, context }),
    mathCalculation: createMathTool({ writer, modelId, locale, context }),
  };
}
