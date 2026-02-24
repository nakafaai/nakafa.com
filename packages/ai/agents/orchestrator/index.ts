import type { ModelId } from "@repo/ai/config/vercel";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { createContentAccessTool } from "./content-access";
import { createMathTool } from "./math";
import { createResearchTool } from "./research";

interface Params {
  context: {
    url: string;
    slug: string;
    verified: boolean;
    userRole?: "teacher" | "student" | "parent" | "administrator";
  };
  locale: string;
  modelId: ModelId;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export function orchestratorTools({
  writer,
  modelId,
  locale,
  context,
}: Params) {
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
