import {
  mathCompare,
  mathDifferentiate,
  mathEvaluate,
  mathSimplify,
} from "@repo/ai/agents/math/descriptions";
import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { prepareMathStep } from "@repo/ai/agents/math/step";
import { compare } from "@repo/ai/agents/math/tools/compare";
import { differentiate } from "@repo/ai/agents/math/tools/differentiate";
import { evaluate } from "@repo/ai/agents/math/tools/evaluate";
import { simplify } from "@repo/ai/agents/math/tools/simplify";
import { model } from "@repo/ai/config/vercel";
import type { MathAgentParams } from "@repo/ai/types/agents";
import {
  MathCompareInputSchema,
  MathDifferentiateInputSchema,
  MathEvaluateInputSchema,
  MathSimplifyInputSchema,
} from "@repo/math/schema";
import { MathService } from "@repo/math/service";
import { generateText, stepCountIs, tool } from "ai";
import { Effect } from "effect";
import * as z from "zod";

/**
 * Runs the math agent and returns text with token usage.
 *
 * References:
 * - AI SDK `prepareStep`: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 * - Program-of-Thoughts: https://arxiv.org/abs/2211.12588
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
        evaluate: tool({
          description: mathEvaluate,
          inputSchema: MathEvaluateInputSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              evaluate({ input, toolCallId, writer }).pipe(
                Effect.provide(MathService.Default)
              )
            ),
        }),
        simplify: tool({
          description: mathSimplify,
          inputSchema: MathSimplifyInputSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              simplify({ input, toolCallId, writer }).pipe(
                Effect.provide(MathService.Default)
              )
            ),
        }),
        differentiate: tool({
          description: mathDifferentiate,
          inputSchema: MathDifferentiateInputSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              differentiate({ input, toolCallId, writer }).pipe(
                Effect.provide(MathService.Default)
              )
            ),
        }),
        compare: tool({
          description: mathCompare,
          inputSchema: MathCompareInputSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compare({ input, toolCallId, writer }).pipe(
                Effect.provide(MathService.Default)
              )
            ),
        }),
      },
      prepareStep: prepareMathStep,
      stopWhen: stepCountIs(8),
    })
  );

  return {
    text: result.text,
    usage: result.totalUsage,
  };
});
