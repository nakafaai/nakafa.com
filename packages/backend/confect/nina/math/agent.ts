import { Agent, createTool, type UsageHandler } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import type { MathAgentParams } from "@repo/backend/confect/nina/contract/agent";
import { textOutputSchema } from "@repo/backend/confect/nina/contract/tools";
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
} from "@repo/backend/confect/nina/math/descriptions";
import { makeMathGenerationError } from "@repo/backend/confect/nina/math/error";
import { mathPrompt } from "@repo/backend/confect/nina/math/prompt";
import { repairMathToolCall } from "@repo/backend/confect/nina/math/repair";
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
} from "@repo/backend/confect/nina/math/schema";
import { prepareMathStep } from "@repo/backend/confect/nina/math/step";
import { compute } from "@repo/backend/confect/nina/math/tools/compute";
import { mathOperations } from "@repo/math/schema/operations";
import { MathService } from "@repo/math/service";
import { isStepCount } from "ai";
import { Effect } from "effect";

const MAX_MATH_STEPS = mathOperations.length;
/**
 * Runs deterministic math tools through Agent; its usage handler records provider calls.
 *
 * References:
 * - AI SDK `prepareStep`: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 * - Program-of-Thoughts: https://arxiv.org/abs/2211.12588
 */
export const runMathAgent = Effect.fn("math.runMathAgent")(function* ({
  userId,
  task,
  modelId,
  locale,
  context,
  publish,
  usageHandler,
}: MathAgentParams & { readonly usageHandler: UsageHandler }) {
  const ctx = yield* ActionCtx;
  const { model, timeout } = (yield* Gateway).language({
    purpose: "specialist",
    model: modelId,
  });
  const math = yield* MathService.make.pipe(
    Effect.mapError(makeMathGenerationError)
  );
  const agent = new Agent(components.nina, {
    name: "math",
    languageModel: model,
    usageHandler,
  });
  const services = yield* Effect.context<ActionCtx | Gateway>();
  const runPromise = Effect.runPromiseWith(services);
  const result = yield* Effect.tryPromise({
    try: (signal) =>
      agent.generateText(
        ctx,
        { userId },
        {
          abortSignal: signal,
          messages: [{ role: "user", content: task }],
          model,
          repairToolCall: (options) =>
            runPromise(
              repairMathToolCall({
                ...options,
                modelId,
                task,
                userId,
                usageHandler,
              })
            ),
          instructions: mathPrompt({ locale, context }),
          prepareStep: prepareMathStep,
          stopWhen: isStepCount(MAX_MATH_STEPS),
          temperature: 0,
          timeout,
          tools: {
            algebra: createTool({
              description: mathAlgebra,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathAlgebraInput,
              outputSchema: textOutputSchema,
            }),
            arithmetic: createTool({
              description: mathArithmetic,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathArithmeticInput,
              outputSchema: textOutputSchema,
            }),
            calculus: createTool({
              description: mathCalculus,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathCalculusInput,
              outputSchema: textOutputSchema,
            }),
            discrete: createTool({
              description: mathDiscrete,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathDiscreteInput,
              outputSchema: textOutputSchema,
            }),
            equation: createTool({
              description: mathEquation,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathEquationInput,
              outputSchema: textOutputSchema,
            }),
            geometry: createTool({
              description: mathGeometry,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathGeometryInput,
              outputSchema: textOutputSchema,
            }),
            matrix: createTool({
              description: mathMatrix,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathMatrixInput,
              outputSchema: textOutputSchema,
            }),
            probability: createTool({
              description: mathProbability,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathProbabilityInput,
              outputSchema: textOutputSchema,
            }),
            series: createTool({
              description: mathSeries,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathSeriesInput,
              outputSchema: textOutputSchema,
            }),
            statistics: createTool({
              description: mathStatistics,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathStatisticsInput,
              outputSchema: textOutputSchema,
            }),
          },
        }
      ),
    catch: makeMathGenerationError,
  });
  return {
    text: result.text,
  };
});
