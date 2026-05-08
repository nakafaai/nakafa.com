import { nakafaCalculator } from "@repo/ai/agents/math/descriptions";
import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { calculatorInputSchema } from "@repo/ai/agents/math/schema";
import { calculate } from "@repo/ai/agents/math/tools/calculator";
import { model } from "@repo/ai/config/vercel";
import type { MathAgentParams } from "@repo/ai/types/agents";
import { generateText, stepCountIs, tool } from "ai";
import { Effect } from "effect";
import * as z from "zod";

/**
 * Runs the math agent and returns text with token usage.
 */
export const runMathAgent = Effect.fn("math.runMathAgent")(function* ({
  task,
  modelId,
  locale,
  context,
  writer,
}: MathAgentParams) {
  const result = yield* Effect.tryPromise(() =>
    generateText({
      model: model.languageModel(modelId),
      system: mathPrompt({ locale, context }),
      messages: [{ role: "user", content: task }],
      tools: {
        calculator: tool({
          description: nakafaCalculator,
          inputSchema: calculatorInputSchema,
          outputSchema: z.string(),
          execute: ({ expression }, { toolCallId }) =>
            Effect.runPromise(calculate({ expression, toolCallId, writer })),
        }),
      },
      stopWhen: stepCountIs(10),
    })
  );

  return {
    text: result.text,
    usage: result.totalUsage,
  };
});
