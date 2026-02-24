import { runMathAgent } from "@repo/ai/agents/math";
import type { MathAgentParams } from "@repo/ai/types/agents";
import { tool } from "ai";
import * as z from "zod";

export const createMathTool = ({
  writer,
  modelId,
  locale,
  context,
}: Omit<MathAgentParams, "task">) => {
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

      return result;
    },
  });
};
