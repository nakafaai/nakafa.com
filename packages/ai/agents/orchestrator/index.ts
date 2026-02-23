import type { ModelId } from "@repo/ai/config/vercel";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { createContentAccessTool } from "./content-access";
import { createMathTool } from "./math";
import { createResearchTool } from "./research";

interface Params {
  locale: string;
  modelId: ModelId;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export function orchestratorTools({ writer, modelId, locale }: Params) {
  return {
    contentAccess: createContentAccessTool({ writer, modelId, locale }),
    deepResearch: createResearchTool({ writer, modelId, locale }),
    mathCalculation: createMathTool({ writer, modelId, locale }),
  };
}
