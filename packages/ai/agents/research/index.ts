import { type ModelId, model } from "@repo/ai/config/vercel";
import type { MyUIMessage } from "@repo/ai/types/message";
import { stepCountIs, streamText, type UIMessageStreamWriter } from "ai";
import { researchPrompt } from "./prompt";
import { researchTools } from "./tools";

interface RunResearchAgentParams {
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
}: RunResearchAgentParams): Promise<string> {
  const result = streamText({
    model: model.languageModel(modelId),
    system: researchPrompt({ locale }),
    messages: [{ role: "user", content: task }],
    tools: researchTools({ writer }),
    stopWhen: stepCountIs(10),
  });

  writer.merge(result.toUIMessageStream());

  await result.consumeStream();

  return result.text;
}
