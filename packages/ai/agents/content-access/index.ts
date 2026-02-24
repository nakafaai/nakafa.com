import { contentAccessPrompt } from "@repo/ai/agents/content-access/prompt";
import { contentAccessTools } from "@repo/ai/agents/content-access/tools";
import { model } from "@repo/ai/config/vercel";
import type { ContentAccessAgentParams } from "@repo/ai/types/agents";
import { generateText, stepCountIs } from "ai";

export async function runContentAccessAgent({
  task,
  writer,
  modelId,
  locale,
  context,
}: ContentAccessAgentParams): Promise<string> {
  const result = await generateText({
    model: model.languageModel(modelId),
    system: contentAccessPrompt({ locale, context }),
    messages: [{ role: "user", content: task }],
    tools: contentAccessTools({ writer }),
    stopWhen: stepCountIs(5),
  });

  return result.text;
}
