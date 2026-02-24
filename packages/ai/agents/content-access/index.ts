import { contentAccessPrompt } from "@repo/ai/agents/content-access/prompt";
import { contentAccessTools } from "@repo/ai/agents/content-access/tools";
import { type ModelId, model } from "@repo/ai/config/vercel";
import type { AgentContext } from "@repo/ai/types/agents";
import type { MyUIMessage } from "@repo/ai/types/message";
import { generateText, stepCountIs, type UIMessageStreamWriter } from "ai";

interface RunContentAccessAgentParams {
  context: AgentContext;
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
