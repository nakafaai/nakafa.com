import {
  mathAlgebra,
  mathArithmetic,
  mathCalculus,
  mathDiscrete,
  mathEquation,
  mathGeometry,
  mathMatrix,
  mathProbability,
  mathSeries,
  mathStatistics,
} from "@repo/ai/agents/math/descriptions";
import { mathPrompt } from "@repo/ai/agents/math/prompt";
import { repairMathToolCall } from "@repo/ai/agents/math/repair";
import {
  mathAlgebraInput,
  mathArithmeticInput,
  mathCalculusInput,
  mathDiscreteInput,
  mathEquationInput,
  mathGeometryInput,
  mathMatrixInput,
  mathProbabilityInput,
  mathSeriesInput,
  mathStatisticsInput,
} from "@repo/ai/agents/math/schema";
import { prepareMathStep } from "@repo/ai/agents/math/step";
import { compute } from "@repo/ai/agents/math/tools/compute";
import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import { getModelProviderOptions } from "@repo/ai/config/models";
import { model } from "@repo/ai/config/vercel";
import { textOutputSchema } from "@repo/ai/schema/tools";
import type { MathAgentParams } from "@repo/ai/types/agents";
import { mathOperations } from "@repo/math/schema/operations";
import { MathService } from "@repo/math/service";
import { generateText, stepCountIs, tool } from "ai";
import { Effect } from "effect";

const MAX_MATH_STEPS = mathOperations.length;

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
      messages: [{ role: "user", content: task }],
      model: model.languageModel(modelId),
      providerOptions: {
        gateway: gatewayProviderOptions,
        google: getModelProviderOptions(modelId),
      },
      experimental_repairToolCall: (options) =>
        Effect.runPromise(
          repairMathToolCall({
            ...options,
            modelId,
            task,
          })
        ),
      prepareStep: prepareMathStep,
      stopWhen: stepCountIs(MAX_MATH_STEPS),
      system: mathPrompt({ locale, context }),
      temperature: 0,
      tools: {
        algebra: tool({
          description: mathAlgebra,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compute({
                input,
                locale,
                toolCallId,
                writer,
              }).pipe(Effect.provide(MathService.Default))
            ),
          inputSchema: mathAlgebraInput,
          outputSchema: textOutputSchema,
        }),
        arithmetic: tool({
          description: mathArithmetic,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compute({
                input,
                locale,
                toolCallId,
                writer,
              }).pipe(Effect.provide(MathService.Default))
            ),
          inputSchema: mathArithmeticInput,
          outputSchema: textOutputSchema,
        }),
        calculus: tool({
          description: mathCalculus,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compute({
                input,
                locale,
                toolCallId,
                writer,
              }).pipe(Effect.provide(MathService.Default))
            ),
          inputSchema: mathCalculusInput,
          outputSchema: textOutputSchema,
        }),
        discrete: tool({
          description: mathDiscrete,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compute({
                input,
                locale,
                toolCallId,
                writer,
              }).pipe(Effect.provide(MathService.Default))
            ),
          inputSchema: mathDiscreteInput,
          outputSchema: textOutputSchema,
        }),
        equation: tool({
          description: mathEquation,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compute({
                input,
                locale,
                toolCallId,
                writer,
              }).pipe(Effect.provide(MathService.Default))
            ),
          inputSchema: mathEquationInput,
          outputSchema: textOutputSchema,
        }),
        geometry: tool({
          description: mathGeometry,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compute({
                input,
                locale,
                toolCallId,
                writer,
              }).pipe(Effect.provide(MathService.Default))
            ),
          inputSchema: mathGeometryInput,
          outputSchema: textOutputSchema,
        }),
        matrix: tool({
          description: mathMatrix,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compute({
                input,
                locale,
                toolCallId,
                writer,
              }).pipe(Effect.provide(MathService.Default))
            ),
          inputSchema: mathMatrixInput,
          outputSchema: textOutputSchema,
        }),
        probability: tool({
          description: mathProbability,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compute({
                input,
                locale,
                toolCallId,
                writer,
              }).pipe(Effect.provide(MathService.Default))
            ),
          inputSchema: mathProbabilityInput,
          outputSchema: textOutputSchema,
        }),
        series: tool({
          description: mathSeries,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compute({
                input,
                locale,
                toolCallId,
                writer,
              }).pipe(Effect.provide(MathService.Default))
            ),
          inputSchema: mathSeriesInput,
          outputSchema: textOutputSchema,
        }),
        statistics: tool({
          description: mathStatistics,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              compute({
                input,
                locale,
                toolCallId,
                writer,
              }).pipe(Effect.provide(MathService.Default))
            ),
          inputSchema: mathStatisticsInput,
          outputSchema: textOutputSchema,
        }),
      },
    })
  );

  return {
    text: result.text,
    usage: result.totalUsage,
  };
});
