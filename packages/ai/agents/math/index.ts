import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { mathTools } from "@repo/ai/agents/math/tools";
import { model } from "@repo/ai/config/vercel";
import type { AgentResult } from "@repo/ai/lib/usage";
import type { MathAgentParams } from "@repo/ai/types/agents";
import { generateText, stepCountIs } from "ai";

/**
 * Run math agent to perform mathematical calculations.
 * Returns both text result and token usage for tracking.
 * Reference: AI SDK best practice - return usage alongside result
 */
export async function runMathAgent({
  task,
  writer,
  modelId,
  locale,
  context,
}: MathAgentParams): Promise<AgentResult> {
  const result = await generateText({
    model: model.languageModel(modelId),
    system: mathPrompt({ locale, context }),
    messages: [{ role: "user", content: task }],
    tools: mathTools({ writer }),
    stopWhen: stepCountIs(10),
  });

  return {
    text: result.text,
    usage: result.totalUsage,
  };
}
