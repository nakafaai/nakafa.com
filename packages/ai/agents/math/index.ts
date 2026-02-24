import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { mathTools } from "@repo/ai/agents/math/tools";
import { model } from "@repo/ai/config/vercel";
import type { MathAgentParams } from "@repo/ai/types/agents";
import { generateText, stepCountIs } from "ai";

export async function runMathAgent({
  task,
  writer,
  modelId,
  locale,
  context,
}: MathAgentParams): Promise<string> {
  const result = await generateText({
    model: model.languageModel(modelId),
    system: mathPrompt({ locale, context }),
    messages: [{ role: "user", content: task }],
    tools: mathTools({ writer }),
    stopWhen: stepCountIs(10),
  });

  return result.text;
}
