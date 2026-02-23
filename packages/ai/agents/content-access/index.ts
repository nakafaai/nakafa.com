import { type ModelId, model } from "@repo/ai/config/vercel";
import type { MyUIMessage } from "@repo/ai/types/message";
import { stepCountIs, streamText, type UIMessageStreamWriter } from "ai";
import { contentAccessPrompt } from "./prompt";
import { contentAccessTools } from "./tools";

interface RunContentAccessAgentParams {
  locale: string;
  modelId: ModelId;
  task: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export async function runContentAccessAgent({
  task,
  writer,
  modelId,
  locale,
}: RunContentAccessAgentParams): Promise<string> {
  const result = streamText({
    model: model.languageModel(modelId),
    system: contentAccessPrompt({ locale }),
    messages: [{ role: "user", content: task }],
    tools: contentAccessTools({ writer }),
    stopWhen: stepCountIs(5),
  });

  writer.merge(result.toUIMessageStream());

  await result.consumeStream();

  return result.text;
}
