import { type ModelId, model } from "@repo/ai/config/vercel";
import type { AgentContext } from "@repo/ai/types/agents";
import type { MyUIMessage } from "@repo/ai/types/message";
import { generateText, stepCountIs, type UIMessageStreamWriter } from "ai";
import { researchPrompt } from "./prompt";
import { researchTools } from "./tools";

interface RunResearchAgentParams {
  context: AgentContext;
  locale: string;
  modelId: ModelId;
  task: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export async function runResearchAgent({
  task,
  writer,
  modelId,
  locale,
  context,
}: RunResearchAgentParams): Promise<string> {
  const result = await generateText({
    model: model.languageModel(modelId),
    system: researchPrompt({ locale, context }),
    messages: [{ role: "user", content: task }],
    tools: researchTools({ writer }),
    stopWhen: stepCountIs(10),
  });

  return result.text;
}
