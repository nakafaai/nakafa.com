import { researchPrompt } from "@repo/ai/agents/research/prompt";
import { researchTools } from "@repo/ai/agents/research/tools";
import { model } from "@repo/ai/config/vercel";
import type { AgentResult } from "@repo/ai/lib/usage";
import type { ResearchAgentParams } from "@repo/ai/types/agents";
import { generateText, stepCountIs } from "ai";

/**
 * Run research agent to conduct web research.
 * Returns both text result and token usage for tracking.
 * Reference: AI SDK best practice - return usage alongside result
 */
export async function runResearchAgent({
  task,
  writer,
  modelId,
  locale,
  context,
}: ResearchAgentParams): Promise<AgentResult> {
  const result = await generateText({
    model: model.languageModel(modelId),
    system: researchPrompt({ locale, context }),
    messages: [{ role: "user", content: task }],
    tools: researchTools({ writer }),
    stopWhen: stepCountIs(3),
  });

  return {
    text: result.text,
    usage: result.totalUsage,
  };
}
