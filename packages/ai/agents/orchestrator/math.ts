import { runMathAgent } from "@repo/ai/agents/math";
import type { ModelId } from "@repo/ai/config/vercel";
import type { MyUIMessage } from "@repo/ai/types/message";
import { tool, type UIMessageStreamWriter } from "ai";
import * as z from "zod";

interface Params {
  locale: string;
  modelId: ModelId;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export const createMathTool = ({ writer, modelId, locale }: Params) => {
  return tool({
    description:
      "Perform mathematical calculations and solve math problems. Use this for ANY mathematical computation - from simple arithmetic to complex expressions.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The mathematical expression or problem to solve (e.g., 'calculate 2+2', 'solve the quadratic equation x^2 + 5x + 6')"
        ),
    }),
    execute: async ({ query }) => {
      const result = await runMathAgent({
        task: query,
        writer,
        modelId,
        locale,
      });

      return result;
    },
  });
};
