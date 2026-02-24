import type { OrchestratorToolParams } from "@repo/ai/types/agents";
import { createContentAccessTool } from "./content-access";
import { createMathTool } from "./math";
import { createResearchTool } from "./research";

export type { AgentContext } from "@repo/ai/types/agents";

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
