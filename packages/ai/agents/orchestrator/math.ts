import { runMathAgent } from "@repo/ai/agents/math";
import type { MathAgentParams, UsageAccumulator } from "@repo/ai/types/agents";
import { tool } from "ai";
import * as z from "zod";

interface MathToolParams extends Omit<MathAgentParams, "task"> {
  usageAccumulator: UsageAccumulator;
}

/**
 * Create math tool with usage tracking.
 * Accumulates token usage from sub-agent for total cost calculation.
 * Reference: AI SDK best practice - track sub-agent usage
 */
export const createMathTool = ({
  writer,
  modelId,
  locale,
  context,
  usageAccumulator,
}: MathToolParams) => {
  return tool({
    description:
      "Perform mathematical calculations and solve math problems. Use this for ANY mathematical computation - from simple arithmetic to complex expressions.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The mathematical expression or problem to solve (e.g., 'calculate 2+2', 'solve the quadratic equation x^2 + 5x + 6'). IMPORTANT: Include the full mathematical problem with all necessary context and variables."
        ),
    }),
    execute: async ({ query }) => {
      const result = await runMathAgent({
        task: query,
        writer,
        modelId,
        locale,
        context,
      });

      // Accumulate usage from sub-agent
      usageAccumulator.addUsage(
        "math",
        result.usage.inputTokens ?? 0,
        result.usage.outputTokens ?? 0
      );

      return result.text;
    },
  });
};
