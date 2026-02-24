import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { mathTools } from "@repo/ai/agents/math/tools";
import { type ModelId, model } from "@repo/ai/config/vercel";
import type { AgentContext } from "@repo/ai/types/agents";
import type { MyUIMessage } from "@repo/ai/types/message";
import { generateText, stepCountIs, type UIMessageStreamWriter } from "ai";

interface RunMathAgentParams {
  context: AgentContext;
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
  context,
}: RunMathAgentParams): Promise<string> {
  const result = await generateText({
    model: model.languageModel(modelId),
    system: mathPrompt({ locale, context }),
    messages: [{ role: "user", content: task }],
    tools: mathTools({ writer }),
    stopWhen: stepCountIs(3),
  });

  return result.text;
}
