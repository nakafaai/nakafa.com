import { runMathAgent } from "@repo/ai/agents/math";
import { TOOL_NAMES } from "@repo/ai/agents/orchestrator";
import type { MathAgentParams, UsageAccumulator } from "@repo/ai/types/agents";
import { tool } from "ai";
import * as z from "zod";

interface MathToolParams extends Omit<MathAgentParams, "task"> {
  usageAccumulator: UsageAccumulator;
}

/**
 * Create math tool with usage tracking.
 */
export const createMathTool = ({
  writer,
  modelId,
  locale,
  context,
  usageAccumulator,
}: MathToolParams) =>
  tool({
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

      usageAccumulator.addUsage(TOOL_NAMES.mathCalculation, result.usage);

      return result.text;
    },
  });
