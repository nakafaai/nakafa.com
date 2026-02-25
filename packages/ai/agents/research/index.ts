import { researchPrompt } from "@repo/ai/agents/research/prompt";
import { researchTools } from "@repo/ai/agents/research/tools";
import { model } from "@repo/ai/config/vercel";
import type { ResearchAgentParams } from "@repo/ai/types/agents";
import { generateText, stepCountIs } from "ai";

export async function runResearchAgent({
  task,
  writer,
  modelId,
  locale,
  context,
}: ResearchAgentParams): Promise<string> {
  const result = await generateText({
    model: model.languageModel(modelId),
    system: researchPrompt({ locale, context }),
    messages: [{ role: "user", content: task }],
    tools: researchTools({ writer }),
    stopWhen: stepCountIs(3),
  });

  return result.text;
}
