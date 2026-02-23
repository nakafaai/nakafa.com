import { type ModelId, model } from "@repo/ai/config/vercel";
import type { MyUIMessage } from "@repo/ai/types/message";
import { stepCountIs, streamText, type UIMessageStreamWriter } from "ai";
import { mathPrompt } from "./prompt";
import { mathTools } from "./tools";

interface RunMathAgentParams {
  locale: string;
  modelId: ModelId;
  task: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export async function runMathAgent({
  task,
  writer,
  modelId,
  locale,
}: RunMathAgentParams): Promise<string> {
  const result = streamText({
    model: model.languageModel(modelId),
    system: mathPrompt({ locale }),
    messages: [{ role: "user", content: task }],
    tools: mathTools({ writer }),
    stopWhen: stepCountIs(3),
  });

  writer.merge(result.toUIMessageStream());

  await result.consumeStream();

  return result.text;
}
