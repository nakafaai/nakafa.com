import { type ModelId, model } from "@repo/ai/config/vercel";
import type { MyUIMessage } from "@repo/ai/types/message";
import { generateText, stepCountIs, type UIMessageStreamWriter } from "ai";
import { contentAccessPrompt } from "./prompt";
import { contentAccessTools } from "./tools";

interface RunContentAccessAgentParams {
  context: {
    url: string;
    slug: string;
    verified: boolean;
    userRole?: "teacher" | "student" | "parent" | "administrator";
  };
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
  context,
}: RunContentAccessAgentParams): Promise<string> {
  const result = await generateText({
    model: model.languageModel(modelId),
    system: contentAccessPrompt({ locale, context }),
    messages: [{ role: "user", content: task }],
    tools: contentAccessTools({ writer }),
    stopWhen: stepCountIs(5),
  });

  return result.text;
}
