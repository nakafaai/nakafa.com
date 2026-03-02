import { contentAccessPrompt } from "@repo/ai/agents/content-access/prompt";
import { contentAccessTools } from "@repo/ai/agents/content-access/tools";
import { model } from "@repo/ai/config/vercel";
import type { AgentResult } from "@repo/ai/lib/usage";
import type { ContentAccessAgentParams } from "@repo/ai/types/agents";
import { generateText, stepCountIs } from "ai";

/**
 * Run content access agent to retrieve Nakafa educational content.
 * Returns both text result and token usage for tracking.
 * Reference: AI SDK best practice - return usage alongside result
 */
export async function runContentAccessAgent({
  task,
  writer,
  modelId,
  locale,
  context,
}: ContentAccessAgentParams): Promise<AgentResult> {
  const result = await generateText({
    model: model.languageModel(modelId),
    system: contentAccessPrompt({ locale, context }),
    messages: [{ role: "user", content: task }],
    tools: contentAccessTools({ writer }),
    stopWhen: stepCountIs(10),
  });

  return {
    text: result.text,
    usage: result.totalUsage,
  };
}
